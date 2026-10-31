import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticate, permit } from '../auth/middleware.js';
import { Product } from '../catalog/model.js';
import { HttpError, validate } from '../../shared/http.js';
import { Cart, Order } from './models.js';

const cartInput = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: z.string().regex(/^[a-f\d]{24}$/i),
            variantKey: z.string().min(1),
            size: z.string().min(1),
            quantity: z.number().int().min(1).max(99),
          })
          .strict(),
      )
      .max(100)
      .refine(
        (items) =>
          new Set(items.map((i) => `${i.productId}:${i.variantKey}:${i.size}`)).size ===
          items.length,
        'No repitas una variante y talla',
      ),
  })
  .strict();
export const shop = Router();
shop.use(authenticate);
shop.get('/cart', async (req, res) =>
  res.json((await Cart.findOne({ userId: req.user!.id })) ?? { items: [] }),
);
shop.put('/cart', validate(cartInput), async (req, res) => {
  const previous = await Cart.findOne({ userId: req.user!.id });
  for (const item of req.body.items) {
    const existing = previous?.items.find(
      (i) =>
        i.productId.toString() === item.productId &&
        i.variantKey === item.variantKey &&
        i.size === item.size,
    );
    if (existing && item.quantity <= existing.quantity) continue;
    const product = await Product.findOne({ _id: item.productId, active: true });
    const size = product?.variants
      .find((v) => v.key === item.variantKey)
      ?.sizes.find((s) => s.size === item.size);
    if (!size || size.stock < item.quantity)
      throw new HttpError(409, 'Una prenda no tiene disponibilidad suficiente');
  }
  res.json(
    await Cart.findOneAndUpdate(
      { userId: req.user!.id },
      { items: req.body.items },
      { upsert: true, new: true },
    ),
  );
});
shop.post(
  '/checkout',
  validate(
    z.object({ paymentMethod: z.enum(['card', 'pse', 'cash']), checkoutKey: z.uuid() }).strict(),
  ),
  async (req, res) => {
    const userId = req.user!.id;
    const { paymentMethod, checkoutKey } = req.body;
    let result;
    try {
      await mongoose.connection.transaction(async (session) => {
        const existing = await Order.findOne({ userId, checkoutKey }).session(session);
        if (existing) {
          result = existing;
          return;
        }
        const cart = await Cart.findOne({ userId }).session(session);
        if (!cart?.items.length) throw new HttpError(400, 'El carrito está vacío');
        const snapshots = [];
        let total = 0;
        for (const item of cart.items) {
          const product = await Product.findOne({ _id: item.productId, active: true }).session(
            session,
          );
          const variant = product?.variants.find((v) => v.key === item.variantKey);
          const size = variant?.sizes.find((s) => s.size === item.size);
          if (!product || !variant || !size || size.stock < item.quantity)
            throw new HttpError(409, 'Stock insuficiente; revisa tu carrito');
          size.stock -= item.quantity;
          await product.save({ session });
          snapshots.push({
            ...item.toObject(),
            name: product.name,
            color: variant.color,
            image: variant.images[0],
            unitPrice: product.price,
            variantSnapshot: {
              color: variant.color,
              hex: variant.hex,
              images: [...variant.images],
            },
          });
          total += product.price * item.quantity;
        }
        const [order] = await Order.create(
          [{ userId, checkoutKey, items: snapshots, total, paymentMethod }],
          { session },
        );
        cart.items.splice(0);
        await cart.save({ session });
        result = order;
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      result = await Order.findOne({ userId, checkoutKey });
      if (!result) throw error;
    }
    res.status(201).json(result);
  },
);
shop.get('/orders', async (req, res) =>
  res.json(await Order.find({ userId: req.user!.id }).sort({ createdAt: -1 })),
);
shop.post(
  '/orders/:id/return',
  validate(z.object({ reason: z.string().trim().min(3).max(1000) }).strict()),
  async (req, res) => {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id, status: 'paid' },
      { status: 'return_requested', returnReason: req.body.reason },
      { new: true },
    );
    if (!order) throw new HttpError(409, 'No se puede solicitar esta devolución');
    res.json(order);
  },
);
shop.get('/returns', async (req, res) =>
  res.json(
    await Order.find({ userId: req.user!.id, status: { $in: ['return_requested', 'returned'] } }),
  ),
);
shop.get('/admin/returns', permit('admin', 'staff'), async (_req, res) =>
  res.json(await Order.find({ status: 'return_requested' })),
);
shop.post('/admin/returns/:id/accept', permit('admin', 'staff'), async (req, res) => {
  let result;
  await mongoose.connection.transaction(async (session) => {
    const order = await Order.findOne({ _id: req.params.id, status: 'return_requested' }).session(
      session,
    );
    if (!order) throw new HttpError(409, 'Devolución no disponible');
    for (const item of order.items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product)
        throw new HttpError(409, 'No se encontró la referencia de inventario de esta devolución');
      let variant = product.variants.find((v) => v.key === item.variantKey);
      if (!variant) {
        if (!item.variantSnapshot?.images?.length)
          throw new HttpError(
            409,
            'Restaura la variante original antes de aceptar esta devolución',
          );
        product.variants.push({
          key: item.variantKey!,
          color: item.variantSnapshot.color!,
          hex: item.variantSnapshot.hex!,
          images: [...item.variantSnapshot.images],
          sizes: [],
        });
        variant = product.variants[product.variants.length - 1];
      }
      const size = variant.sizes.find((s) => s.size === item.size);
      if (size) size.stock += item.quantity!;
      else variant.sizes.push({ size: item.size!, stock: item.quantity! });
      await product.save({ session });
    }
    order.status = 'returned';
    await order.save({ session });
    result = order;
  });
  res.json(result);
});
