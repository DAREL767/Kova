import { Router } from 'express';
import type { FilterQuery } from 'mongoose';
import { z } from 'zod';
import { Product } from './model.js';
import { productInput, productUpdateInput } from './validation.js';
import { categories, normalizeCategory } from './categories.js';
import { authenticate, permit } from '../auth/middleware.js';
import { HttpError, validate } from '../../shared/http.js';

const queryInput = z.object({
  category: z.preprocess(normalizeCategory, z.enum(categories)).optional(),
  gender: z.enum(['hombre', 'mujer', 'unisex']).optional(),
  q: z.string().trim().max(100).optional(),
  collection: z.enum(['ropa', 'calzado']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  seed: z.coerce.number().min(0).max(1).default(0),
});
const canonical = <T extends { category?: string }>(p: T) => ({
  ...p,
  category: normalizeCategory(p.category),
});
function filter(query: z.infer<typeof queryInput>): FilterQuery<unknown> {
  const match: FilterQuery<unknown> = { active: true };
  if (query.category)
    match.category = query.category === 'calzado' ? { $in: ['calzado', 'tenis'] } : query.category;
  else if (query.collection)
    match.category =
      query.collection === 'calzado'
        ? { $in: ['calzado', 'tenis', 'guayos'] }
        : { $nin: ['calzado', 'tenis', 'guayos'] };
  if (query.gender)
    match.gender = query.gender === 'unisex' ? 'unisex' : { $in: [query.gender, 'unisex'] };
  if (query.q)
    match.name = { $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  return match;
}
export const catalog = Router();
catalog.get('/browse', async (req, res) => {
  const query = queryInput.parse(req.query);
  const match = filter(query);
  const [items, total] = await Promise.all([
    Product.aggregate([
      { $match: match },
      {
        $addFields: {
          _priority: { $cond: [{ $gte: [{ $ifNull: ['$displayOrder', 0] }, query.seed] }, 1, 0] },
        },
      },
      { $sort: { _priority: -1, displayOrder: 1, _id: 1 } },
      { $skip: (query.page - 1) * query.limit },
      { $limit: query.limit },
      { $project: { _priority: 0 } },
    ]),
    Product.countDocuments(match),
  ]);
  res.json({
    items: items.map(canonical),
    total,
    page: query.page,
    pages: Math.ceil(total / query.limit),
  });
});
catalog.get('/manage', authenticate, permit('admin', 'staff'), async (req, res) => {
  const query = queryInput.parse(req.query);
  const match = filter(query);
  const [items, total] = await Promise.all([
    Product.find(match)
      .sort({ updatedAt: -1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Product.countDocuments(match),
  ]);
  res.json({ items, total, page: query.page, pages: Math.ceil(total / query.limit) });
});
catalog.get('/', async (req, res) => {
  const query = queryInput.parse(req.query);
  res.json(
    (await Product.aggregate([{ $match: filter(query) }, { $sample: { size: query.limit } }])).map(
      canonical,
    ),
  );
});
catalog.get('/:id', async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, active: true });
  if (!product) throw new HttpError(404, 'Prenda no encontrada');
  res.json(product);
});
catalog.get('/:id/suggestions', async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, active: true });
  if (!product) throw new HttpError(404, 'Prenda no encontrada');
  const related = await Product.aggregate([
    {
      $match: {
        active: true,
        _id: { $ne: product._id },
        category:
          product.category === 'calzado' || String(product.category) === 'tenis'
            ? { $in: ['calzado', 'tenis'] }
            : product.category,
      },
    },
    { $sample: { size: 8 } },
  ]);
  const others =
    related.length < 8
      ? await Product.aggregate([
          { $match: { active: true, _id: { $nin: [product._id, ...related.map((p) => p._id)] } } },
          { $sample: { size: 8 - related.length } },
        ])
      : [];
  res.json([...related, ...others].map(canonical));
});
catalog.use(authenticate, permit('admin', 'staff'));
catalog.post('/', validate(productInput), async (req, res) =>
  res.status(201).json(await Product.create(req.body)),
);
catalog.put('/:id', validate(productUpdateInput), async (req, res) => {
  const { revision, ...data } = req.body;
  const original = await Product.findOne({ _id: req.params.id, active: true });
  if (!original) throw new HttpError(404, 'Prenda no encontrada');
  for (const v of data.variants) {
    if (
      !original.variants.some((old) => old.key === v.key) &&
      !v.sizes.some((s: { stock: number }) => s.stock > 0)
    )
      throw new HttpError(400, 'Cada color nuevo debe tener stock disponible');
  }
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, active: true, __v: revision },
    { $set: data, $inc: { __v: 1 } },
    { new: true, runValidators: true },
  );
  if (!product)
    throw new HttpError(409, 'El inventario cambió. Recarga la prenda antes de guardar.');
  res.json(product);
});
catalog.delete('/:id', async (req, res) => {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, active: true },
    { $set: { active: false }, $inc: { __v: 1 } },
  );
  if (!product) throw new HttpError(404, 'Prenda no encontrada');
  res.sendStatus(204);
});
