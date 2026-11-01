import { Schema, model } from 'mongoose';

export const User = model(
  'User',
  new Schema(
    {
      name: { type: String, required: true },
      email: {
        type: String,
        required: function (this: { username?: string }) {
          return !this.username;
        },
        unique: true,
        lowercase: true,
      },
      username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
      passwordHash: { type: String, required: true, select: false },
      role: {
        type: String,
        enum: ['admin', 'staff', 'customer'],
        default: 'customer',
        required: true,
      },
      staffSlot: { type: Number, enum: [1, 2] },
      active: { type: Boolean, default: true },
      tokenVersion: { type: Number, default: 0, select: false },
    },
    { timestamps: true },
  )
    .index({ staffSlot: 1 }, { unique: true, sparse: true })
    .index({ role: 1 }, { unique: true, partialFilterExpression: { role: 'admin' } }),
);
