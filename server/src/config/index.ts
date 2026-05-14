import dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT || 3001,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/quizbattle',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  bullmq: {
    queueName: 'game_rounds',
    concurrency: 5,
  },
  game: {
    roundDurationMs: 15000,
    totalRounds: 10,
    maxPlayersPerRoom: 2,
    basePoints: 100,
  },
};
