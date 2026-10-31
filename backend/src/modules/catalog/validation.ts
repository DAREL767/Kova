import { z } from 'zod';
import { categories, normalizeCategory } from './categories.js';
import { imageReference } from '../../shared/validation.js';
const unique = (values: string[]) => new Set(values).size === values.length;
export const productFields = z
  .object({
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().min(1).max(5000),
    category: z.preprocess(normalizeCategory, z.enum(categories)),
    gender: z.enum(['hombre', 'mujer', 'unisex']),
    price: z.number().int().positive().max(100000000),
    variants: z
      .array(
        z
          .object({
            key: z.string().regex(/^[a-z0-9-]{1,60}$/),
            color: z.string().trim().min(1).max(60),
            hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
            images: z
              .array(imageReference)
              .min(2)
              .max(12)
              .refine(unique, 'Las imágenes de una variante deben ser diferentes'),
            sizes: z
              .array(
                z
                  .object({
                    size: z.string().trim().min(1).max(20),
                    stock: z.number().int().min(0).max(100000),
                  })
                  .strict(),
              )
              .min(1)
              .refine((v) => unique(v.map((s) => s.size)), 'Las tallas no pueden repetirse'),
          })
          .strict(),
      )
      .min(1)
      .max(30)
      .refine((v) => unique(v.map((c) => c.key)), 'Las variantes no pueden repetirse'),
  })
  .strict();
export const productInput = productFields.refine(
  (p) => p.variants.every((v) => v.sizes.some((s) => s.stock > 0)),
  'Cada color nuevo debe tener stock disponible',
);
export const productUpdateInput = productFields.extend({ revision: z.number().int().min(0) });
