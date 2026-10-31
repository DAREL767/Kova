import { z } from 'zod';
export const imageReference = z.union([
  z.url().refine((value) => value.startsWith('https://'), 'Usa una imagen HTTPS'),
  z.string().regex(/^\/api\/media\/[a-f\d]{24}$/i),
]);
