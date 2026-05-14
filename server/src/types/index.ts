export interface Question {
  question: string;
  options: string[];
  answer: number;
}

export interface Player {
  socketId: string;
  username: string;
  score: number;
  answered: boolean;
  lastAnswerCorrect?: boolean;
}

export interface GameState {
  roomId: string;
  players: { [socketId: string]: Player };
  currentQuestionIndex: number;
  roundStartTime: number;
  isFinished: boolean;
  totalRounds: number;
}

export enum SocketEvents {
  CONNECTION = 'connection',
  JOIN_MATCHMAKING = 'join-matchmaking',
  MATCH_FOUND = 'match-found',
  GAME_START = 'game-start',
  NEXT_ROUND = 'next-round',
  SUBMIT_ANSWER = 'submit-answer',
  ROUND_RESULT = 'round-result',
  GAME_OVER = 'game-over',
  DISCONNECT = 'disconnect',
  PLAYER_RECONNECTED = 'player-reconnected',
}
