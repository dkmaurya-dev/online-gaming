import { Server } from 'socket.io';
import { GameState, Player, Question, SocketEvents } from '../types';
import { RedisService } from './RedisService';
import { questions } from '../data/questions';
import { config } from '../config';
import { roundQueue } from '../workers/RoundWorker';
import Match from '../models/Match';
import User from '../models/User';

export class GameService {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  public async startMatch(players: { socketId: string, username: string }[]): Promise<void> {
    const roomId = `room:${Date.now()}`;
    const gameState: GameState = {
      roomId,
      players: {},
      currentQuestionIndex: 0,
      roundStartTime: Date.now(),
      isFinished: false,
      totalRounds: Math.min(config.game.totalRounds, questions.length),
    };

    for (const p of players) {
      gameState.players[p.socketId] = {
        socketId: p.socketId,
        username: p.username,
        score: 0,
        answered: false,
      };
      // Join room
      this.io.sockets.sockets.get(p.socketId)?.join(roomId);
      await RedisService.setUserRoom(p.socketId, roomId);
    }

    await RedisService.setGameState(roomId, gameState);

    // Emit match found and first question
    this.io.to(roomId).emit(SocketEvents.MATCH_FOUND, { roomId, players: Object.values(gameState.players) });
    
    // Start first round with 1sec delay for UX
    setTimeout(() => this.startRound(roomId, 0), 2000);
  }

  public async startRound(roomId: string, roundIndex: number): Promise<void> {
    const state = await RedisService.getGameState(roomId);
    if (!state || state.isFinished) return;

    state.currentQuestionIndex = roundIndex;
    state.roundStartTime = Date.now();
    
    // Reset players answered status
    Object.keys(state.players).forEach(sid => {
      state.players[sid].answered = false;
    });

    await RedisService.setGameState(roomId, state);

    const question = questions[roundIndex];
    // Don't send the answer to the client!
    const clientQuestion = {
      question: question.question,
      options: question.options,
      roundIndex,
      totalRounds: state.totalRounds,
    };

    this.io.to(roomId).emit(SocketEvents.NEXT_ROUND, clientQuestion);

    // Schedule timeout job
    await roundQueue.add(
      `round_timeout_${roomId}_${roundIndex}`,
      { roomId, roundIndex },
      { delay: config.game.roundDurationMs, removeOnComplete: true }
    );
  }

  public async handleAnswer(socketId: string, roomId: string, answerIndex: number): Promise<void> {
    const state = await RedisService.getGameState(roomId);
    if (!state || state.isFinished) return;

    const player = state.players[socketId];
    if (!player || player.answered) return;

    const currentQuestion = questions[state.currentQuestionIndex];
    const isCorrect = currentQuestion.answer === answerIndex;

    player.answered = true;
    player.lastAnswerCorrect = isCorrect;

    if (isCorrect) {
      const timeTaken = Date.now() - state.roundStartTime;
      const timeLeft = Math.max(0, config.game.roundDurationMs - timeTaken);
      const speedBonus = Math.floor((timeLeft / config.game.roundDurationMs) * 50);
      player.score += config.game.basePoints + speedBonus;
    }

    await RedisService.setGameState(roomId, state);

    // Inform the specific player about their result
    this.io.to(socketId).emit(SocketEvents.ROUND_RESULT, {
      isCorrect,
      correctAnswer: currentQuestion.answer,
      score: player.score
    });

    // Check if all players answered
    const allAnswered = Object.values(state.players).every(p => p.answered);
    if (allAnswered) {
      this.endRound(roomId);
    }
  }

  public async endRound(roomId: string): Promise<void> {
    const state = await RedisService.getGameState(roomId);
    if (!state || state.isFinished) return;

    const currentQuestion = questions[state.currentQuestionIndex];

    // Check if anyone didn't answer (timeout case)
    let stateChanged = false;
    for (const sid of Object.keys(state.players)) {
      if (!state.players[sid].answered) {
        this.io.to(sid).emit(SocketEvents.ROUND_RESULT, {
          isCorrect: false,
          correctAnswer: currentQuestion.answer,
          score: state.players[sid].score,
          timeout: true
        });
        state.players[sid].answered = true;
        stateChanged = true;
      }
    }

    if (stateChanged) {
      await RedisService.setGameState(roomId, state);
    }

    if (state.currentQuestionIndex + 1 < state.totalRounds) {
      // Next round
      setTimeout(() => this.startRound(roomId, state.currentQuestionIndex + 1), 2000);
    } else {
      // Game over
      this.endGame(roomId);
    }
  }

  public async endGame(roomId: string): Promise<void> {
    const state = await RedisService.getGameState(roomId);
    if (!state || state.isFinished) return;

    state.isFinished = true;
    await RedisService.setGameState(roomId, state);

    const players = Object.values(state.players);
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];

    this.io.to(roomId).emit(SocketEvents.GAME_OVER, {
      players: sortedPlayers,
      winner: winner.username,
    });

    // Save to MongoDB
    try {
      await Match.create({
        roomId,
        players: players.map(p => ({
          username: p.username,
          score: p.score,
          winner: p.username === winner.username
        }))
      });

      // Update User XP/Stats
      for (const p of players) {
        await User.findOneAndUpdate(
          { username: p.username },
          { 
            $inc: { totalScore: p.score, matchesPlayed: 1 },
            $set: { updatedAt: new Date() }
          },
          { upsert: true }
        );
      }
    } catch (error) {
      console.error('Error saving match to DB:', error);
    }

    // Cleanup Redis after some delay
    setTimeout(() => {
      RedisService.deleteGameState(roomId).catch(console.error);
      players.forEach(p => RedisService.deleteUserRoom(p.socketId).catch(console.error));
    }, 60000);
  }

  public async handleDisconnect(socketId: string): Promise<void> {
    const roomId = await RedisService.getUserRoom(socketId);
    if (!roomId) return;

    const state = await RedisService.getGameState(roomId);
    if (!state || state.isFinished) {
      await RedisService.deleteUserRoom(socketId);
      return;
    }

    const leavingPlayer = state.players[socketId];
    if (!leavingPlayer) return;

    // Log the abandonment
    console.log(`Player ${leavingPlayer.username} left room ${roomId}`);

    // Mark game as finished
    state.isFinished = true;
    await RedisService.setGameState(roomId, state);

    // Identify winners (everyone else)
    const players = Object.values(state.players);
    const winners = players.filter(p => p.socketId !== socketId);

    if (winners.length > 0) {
      this.io.to(roomId).emit(SocketEvents.GAME_OVER, {
        players: players.map(p => ({
          ...p,
          winner: p.socketId !== socketId
        })),
        winner: winners[0].username,
        reason: `${leavingPlayer.username} disconnected. You win!`
      });

      // Save to MongoDB as a forfeit match
      try {
        await Match.create({
          roomId,
          players: players.map(p => ({
            username: p.username,
            score: p.score,
            winner: p.socketId !== socketId
          }))
        });
      } catch (err) {
        console.error('Error saving forfeit match:', err);
      }
    }

    await RedisService.deleteUserRoom(socketId);
  }
}
