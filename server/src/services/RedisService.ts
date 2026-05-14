import Redis from 'ioredis';
import { config } from '../config';
import { GameState } from '../types';

export class RedisService {
  private static instance: Redis;

  public static getInstance(): Redis {
    if (!RedisService.instance) {
      RedisService.instance = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        maxRetriesPerRequest: null, // Essential for BullMQ
      });
      RedisService.instance.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });
    }
    return RedisService.instance;
  }

  // Set game state with TTL
  public static async setGameState(roomId: string, state: GameState): Promise<void> {
    const redis = RedisService.getInstance();
    await redis.set(`game:${roomId}`, JSON.stringify(state), 'EX', 3600); // 1 hour TTL
  }

  // Get game state
  public static async getGameState(roomId: string): Promise<GameState | null> {
    const redis = RedisService.getInstance();
    const state = await redis.get(`game:${roomId}`);
    return state ? JSON.parse(state) : null;
  }

  // Delete game state
  public static async deleteGameState(roomId: string): Promise<void> {
    const redis = RedisService.getInstance();
    await redis.del(`game:${roomId}`);
  }

  // Add player to matchmaking queue
  public static async addToQueue(socketId: string, username: string): Promise<void> {
    const redis = RedisService.getInstance();
    await redis.lpush('matchmaking_queue', JSON.stringify({ socketId, username }));
  }

  // Remove player from queue
  public static async removeFromQueue(socketId: string): Promise<void> {
    console.log('Removing player from queue:', socketId);
    const redis = RedisService.getInstance();
    // This is less efficient but since it is a small scale demo it is fine. 
    // In production we would use a Set or Hash for faster access.
    const players = await redis.lrange('matchmaking_queue', 0, -1);
    for (const playerJson of players) {
      const player = JSON.parse(playerJson);
      if (player.socketId === socketId) {
        await redis.lrem('matchmaking_queue', 0, playerJson);
        break;
      }
    }
  }

  // Get two players for a match
  public static async popMatch(): Promise<{ socketId: string, username: string }[] | null> {
    const redis = RedisService.getInstance();
    const count = await redis.llen('matchmaking_queue');
    if (count >= 2) {
      const p1 = await redis.rpop('matchmaking_queue');
      const p2 = await redis.rpop('matchmaking_queue');
      if (p1 && p2) {
        return [JSON.parse(p1), JSON.parse(p2)];
      }
    }
    return null;
  }

  // Map user to roomId
  public static async setUserRoom(socketId: string, roomId: string): Promise<void> {
    const redis = RedisService.getInstance();
    await redis.set(`user_room:${socketId}`, roomId, 'EX', 3600);
  }

  public static async getUserRoom(socketId: string): Promise<string | null> {
    const redis = RedisService.getInstance();
    const result = await redis.get(`user_room:${socketId}`);
    return result;
  }

  public static async deleteUserRoom(socketId: string): Promise<void> {
    const redis = RedisService.getInstance();
    await redis.del(`user_room:${socketId}`);
  }
}
