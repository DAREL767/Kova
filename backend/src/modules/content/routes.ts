import { Router } from 'express';
import { Content } from './model.js';
import { z } from 'zod';
import { authenticate, permit } from '../auth/middleware.js';
import { validate } from '../../shared/http.js';
import { imageReference as https } from '../../shared/validation.js';
const internalLink = z
  .string()
  .max(300)
  .regex(/^\/(?!\/)[^\\\s]*$/);
const banner = z
  .object({
    title: z.string().trim().min(1).max(120),
    subtitle: z.string().trim().max(500),
    image: https.optional(),
    ctaLabel: z.string().trim().max(50).optional(),
    href: internalLink.optional(),
  })
  .strict();
const legacyAbout = z
  .object({
    title: z.string().trim().min(1).max(160),
    text: z.string().max(20000),
    image: https.optional(),
  })
  .strict();
const aboutSection = legacyAbout.extend({
  id: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
  text: z.string().trim().min(1).max(20000),
});
const aboutContent = z
  .object({
    sections: z
      .array(aboutSection)
      .max(30)
      .refine(
        (sections) => new Set(sections.map((section) => section.id)).size === sections.length,
        'Las secciones no pueden repetirse',
      )
      .refine(
        (sections) => sections.reduce((total, section) => total + section.text.length, 0) <= 100000,
        'El contenido total es demasiado largo',
      ),
  })
  .strict();
const input = z.discriminatedUnion('key', [
  z
    .object({
      key: z.literal('about'),
      value: z.union([aboutContent, legacyAbout]),
    })
    .strict(),
  z
    .object({
      key: z.literal('carousel'),
      value: z
        .array(
          z
            .object({
              title: z.string().trim().min(1).max(120),
              image: https,
              href: internalLink.optional(),
            })
            .strict(),
        )
        .max(12),
    })
    .strict(),
  z.object({ key: z.literal('homeBanner'), value: banner }).strict(),
  z.object({ key: z.literal('contactBanner'), value: banner }).strict(),
  z
    .object({ key: z.literal('accessBanner'), value: banner.omit({ ctaLabel: true, href: true }) })
    .strict(),
  z
    .object({ key: z.literal('aboutBanner'), value: banner.omit({ ctaLabel: true, href: true }) })
    .strict(),
]);
export const content = Router();
content.get('/', async (_req, res) => res.json(await Content.find().select('key value -_id')));
content.put('/', authenticate, permit('admin', 'staff'), validate(input), async (req, res) =>
  res.json(
    await Content.findOneAndUpdate(
      { key: req.body.key },
      { value: req.body.value },
      { upsert: true, new: true, runValidators: true },
    ),
  ),
);
