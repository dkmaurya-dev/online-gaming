import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  totalScore: number;
  matchesPlayed: number;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  totalScore: { type: Number, default: 0 },
  matchesPlayed: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model<IUser>('User', UserSchema);
