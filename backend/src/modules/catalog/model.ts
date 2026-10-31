import { Schema, model } from 'mongoose';
import { categories } from './categories.js';

const sizeSchema = new Schema(
  { size: { type: String, required: true }, stock: { type: Number, min: 0, required: true } },
  { _id: false },
);
const variantSchema = new Schema(
  {
    key: { type: String, required: true },
    color: { type: String, required: true },
    hex: { type: String, required: true },
    images: { type: [String], required: true, validate: (v: string[]) => v.length >= 2 },
    sizes: { type: [sizeSchema], required: true },
  },
  { _id: false },
);
const productSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, enum: categories, required: true },
    gender: { type: String, enum: ['hombre', 'mujer', 'unisex'], required: true },
    price: { type: Number, min: 1, required: true },
    currency: { type: String, default: 'COP', enum: ['COP'] },
    variants: { type: [variantSchema], required: true },
    active: { type: Boolean, default: true },
    displayOrder: { type: Number, default: Math.random, immutable: true },
  },
  { timestamps: true, optimisticConcurrency: true },
).index({ active: 1, category: 1, gender: 1 });
productSchema.pre('validate', function () {
  if (String(this.category) === 'tenis') this.category = 'calzado';
});
productSchema.set('toJSON', {
  transform(_doc, value) {
    if (String(value.category) === 'tenis') value.category = 'calzado';
    return value;
  },
});
export const Product = model('Product', productSchema);
