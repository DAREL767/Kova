import { Schema, model } from 'mongoose';
const item = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    variantKey: { type: String, required: true },
    size: { type: String, required: true },
    quantity: { type: Number, min: 1, required: true },
  },
  { _id: false },
);
export const Cart = model(
  'Cart',
  new Schema(
    {
      userId: { type: Schema.Types.ObjectId, required: true, unique: true },
      items: { type: [item], default: [] },
    },
    { timestamps: true },
  ),
);
const orderItem = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    variantKey: String,
    size: String,
    quantity: Number,
    name: String,
    color: String,
    image: String,
    unitPrice: Number,
    variantSnapshot: {
      type: new Schema({ color: String, hex: String, images: [String] }, { _id: false }),
      required: false,
    },
  },
  { _id: false },
);
export const Order = model(
  'Order',
  new Schema(
    {
      userId: { type: Schema.Types.ObjectId, required: true, index: true },
      checkoutKey: { type: String, required: true },
      items: [orderItem],
      total: { type: Number, required: true },
      currency: { type: String, default: 'COP' },
      paymentMethod: { type: String, enum: ['card', 'pse', 'cash'], required: true },
      simulated: { type: Boolean, default: true },
      status: { type: String, enum: ['paid', 'return_requested', 'returned'], default: 'paid' },
      returnReason: String,
    },
    { timestamps: true },
  ).index({ userId: 1, checkoutKey: 1 }, { unique: true }),
);
