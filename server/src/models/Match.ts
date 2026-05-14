import mongoose, { Schema, Document } from 'mongoose';

export interface IMatch extends Document {
  roomId: string;
  players: {
    username: string;
    score: number;
    winner: boolean;
  }[];
  finishedAt: Date;
}

const MatchSchema: Schema = new Schema({
  roomId: { type: String, required: true },
  players: [
    {
      username: { type: String, required: true },
      score: { type: Number, required: true },
      winner: { type: Boolean, default: false },
    },
  ],
  finishedAt: { type: Date, default: Date.now },
});

export default mongoose.model<IMatch>('Match', MatchSchema);
