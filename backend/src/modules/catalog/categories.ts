export const categories = [
  'calzado',
  'camisas',
  'guayos',
  'camisetas',
  'buzos',
  'pantalonetas',
  'bermudas',
  'sacos',
] as const;
export const catalogCategories = [...categories, 'tenis'];
export const normalizeCategory = (value: unknown) => (value === 'tenis' ? 'calzado' : value);
