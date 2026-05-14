import { Worker, Queue } from 'bullmq';
import { config } from '../config';
import { RedisService } from '../services/RedisService';
import { SocketEvents } from '../types';
import { Server } from 'socket.io';

export const roundQueue = new Queue(config.bullmq.queueName, {
  connection: RedisService.getInstance(),
});

export const createRoundWorker = (io: Server) => {
  const worker = new Worker(
    config.bullmq.queueName,
    async (job) => {
      const { roomId, roundIndex } = job.data;
      const state = await RedisService.getGameState(roomId);

      if (!state || state.currentQuestionIndex !== roundIndex || state.isFinished) {
        return;
      }

      // If we reach here, the round timed out
      console.log(`Round ${roundIndex} timed out for room ${roomId}`);
      
      const { GameService } = await import('../services/GameService');
      const gameService = new GameService(io);
      await gameService.endRound(roomId);
    },
    {
      connection: RedisService.getInstance(),
      concurrency: config.bullmq.concurrency,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
  });

  return worker;
};
