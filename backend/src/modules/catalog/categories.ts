export const categories = [
  'calzado',
  'camisas',
  'pantalones',
  'guayos',
  'camisetas',
  'buzos',
  'pantalonetas',
  'bermudas',
  'sacos',
] as const;
export const normalizeCategory = (value: unknown) => (value === 'tenis' ? 'calzado' : value);
