import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { config } from './config';

const app = express();

app.use(helmet());
app.use(cors({

  origin: ["http://localhost:3000"],
  methods: ["GET", "POST"]

}));
app.use(morgan('dev'));
app.use(express.json());

// Routes for matching history or leaderboard
app.get('/api/match-history', async (req, res) => {
  try {
    const Match = mongoose.model('Match');
    const matches = await Match.find().sort({ finishedAt: -1 }).limit(10);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const User = mongoose.model('User');
    const leaderboard = await User.find().sort({ totalScore: -1 }).limit(10);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default app;
