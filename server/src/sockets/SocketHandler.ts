import { Server, Socket } from 'socket.io';
import { SocketEvents } from '../types';
import { RedisService } from '../services/RedisService';
import { GameService } from '../services/GameService';

export class SocketHandler {
  private io: Server;
  private gameService: GameService;

  constructor(io: Server) {
    this.io = io;
    this.gameService = new GameService(io);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.io.on(SocketEvents.CONNECTION, (socket: Socket) => {
      console.log(`User connected: ${socket.id}`);

      // Join Matchmaking
      socket.on(SocketEvents.JOIN_MATCHMAKING, async ({ username }) => {
        console.log(`User ${username} joined matchmaking queue.`);
        await RedisService.addToQueue(socket.id, username);

        // Try to match players
        const match = await RedisService.popMatch();
        if (match) {
          console.log(`Match found between ${match[0].username} and ${match[1].username}`);
          await this.gameService.startMatch(match);
        }
      });

      // Submit Answer
      socket.on(SocketEvents.SUBMIT_ANSWER, async ({ roomId, answerIndex }) => {
        await this.gameService.handleAnswer(socket.id, roomId, answerIndex);
      });

      // Disconnect
      socket.on(SocketEvents.DISCONNECT, async () => {
        console.log(`User disconnected: ${socket.id}`);
        await RedisService.removeFromQueue(socket.id);
        await this.gameService.handleDisconnect(socket.id);
      });
    });
  }
}
