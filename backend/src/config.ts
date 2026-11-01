import 'dotenv/config';
import { z } from 'zod';

export const config = z
  .object({
    PORT: z.coerce.number().int().positive().default(4000),
    MONGODB_URI: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    CLIENT_ORIGIN: z
      .url()
      .default(
        process.env.NODE_ENV === 'production'
          ? 'https://kova-ten-omega.vercel.app'
          : 'http://localhost:5173',
      )
      .transform((value) => new URL(value).origin),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    COOKIE_SAME_SITE: z
      .enum(['strict', 'lax', 'none'])
      .default(process.env.NODE_ENV === 'production' ? 'none' : 'strict'),
  })
  .parse(process.env);

// The deployed storefront stays allowed even if an old local CLIENT_ORIGIN is configured.
export const allowedClientOrigins = new Set([
  'https://kova-ten-omega.vercel.app',
  config.CLIENT_ORIGIN,
]);
