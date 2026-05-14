import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import mongoose from 'mongoose';
import app from './app';
import { config } from './config';
import { RedisService } from './services/RedisService';
import { SocketHandler } from './sockets/SocketHandler';
import { createRoundWorker } from './workers/RoundWorker';

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const pubClient = RedisService.getInstance();
const subClient = pubClient.duplicate({
  enableReadyCheck: false,
});

pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));

async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

    // Setup Redis Adapter for Socket.IO horizontal scaling
    io.adapter(createAdapter(pubClient, subClient));

    // Initialize Socket Handlers
    new SocketHandler(io);

    // Initialize BullMQ Workers
    createRoundWorker(io);

    server.listen(config.port, () => {
      console.log(`Server is running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
