import 'dotenv/config';
import { z } from 'zod';

export const config = z
  .object({
    PORT: z.coerce.number().int().positive().default(4000),
    MONGODB_URI: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  })
  .parse(process.env);
