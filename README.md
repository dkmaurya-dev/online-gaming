# Quiz Battle Arena 🧠 vs 🧠

A production-ready, real-time multiplayer quiz game built with a modern distributed architecture.

## Tech Stack
- **Frontend**: Next.js 14, Tailwind CSS, Framer Motion, Socket.IO Client
- **Backend**: Node.js, TypeScript, Express, Socket.IO
- **Database**: MongoDB (Historical Match Data & Leaderboards)
- **Cache**: Redis (Active Game State & Matchmaking Queue)
- **Background Jobs**: BullMQ (Round Timers & Cleanup)

## Features
- **Real-time Matchmaking**: Automatic pairing of players using a Redis-backed queue.
- **Dynamic Scoring**: Points are awarded based on speed and correctness.
- **Reliable Timers**: Round transitions are managed server-side via BullMQ delayed jobs.
- **Scalable Architecture**: Support for horizontal scaling using the Socket.IO Redis Adapter.
- **Premium UI**: Neon aesthetics with glassmorphism and fluid animations.

## Local Setup

### Prerequisites
- Node.js v18+
- Docker & Docker Compose

### 1. Spin up Infrastructure
```bash
docker-compose up -d
```
This starts MongoDB and Redis.

### 2. Setup Backend
```bash
cd server
npm install
npm run dev
```
Backend runs on `http://localhost:3001`.

### 3. Setup Frontend
```bash
cd client
npm install
npm run dev
```
Frontend runs on `http://localhost:3000`.

## Architecture & Scaling
For 10k–100k concurrent users:
1. **Horizontal Scaling**: Node.js servers can be scaled behind an Nginx load balancer with **sticky sessions**.
2. **Redis Adapter**: Ensures that Socket.IO events are broadcasted correctly across multiple server instances.
3. **Stateless Logic**: Active game state is pinned to Redis, allowing any server to handle a request for any room.
4. **BullMQ Distributon**: Background workers can be separated from the main API servers to handle heavy job processing.

## Folder Structure
- `server/src/sockets`: Real-time event orchestration.
- `server/src/services`: Game logic and state management.
- `server/src/workers`: Background task processing.
- `client/src/components`: UI state machine and animations.
