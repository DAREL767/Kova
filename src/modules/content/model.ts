import { Schema, model } from 'mongoose';
export const Content = model(
  'Content',
  new Schema(
    {
      key: { type: String, unique: true, required: true },
      value: { type: Schema.Types.Mixed, required: true },
    },
    { timestamps: true },
  ),
);
