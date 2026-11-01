export const categories = [
  'guayos',
  'camisetas',
  'buzos',
  'pantalonetas',
  'bermudas',
  'sacos',
  'pantalones',
  'calzado',
  'camisas',
] as const;
export type Category = (typeof categories)[number];
export interface Variant {
  key: string;
  color: string;
  hex: string;
  images: string[];
  sizes: { size: string; stock: number }[];
}
export interface Product {
  _id: string;
  name: string;
  description: string;
  category: Category;
  gender: string;
  price: number;
  variants: Variant[];
  __v: number;
}
export interface User {
  id: string;
  name: string;
  email?: string;
  role: string;
}
export interface CartItem {
  productId: string;
  variantKey: string;
  size: string;
  quantity: number;
}
export interface Order {
  _id: string;
  createdAt: string;
  status: string;
  total: number;
  paymentMethod: string;
  items: {
    name: string;
    color: string;
    size: string;
    quantity: number;
    image: string;
    unitPrice: number;
  }[];
}
export interface Slide {
  title: string;
  image: string;
  href?: string;
}
export interface About {
  title: string;
  text: string;
  image?: string;
}
export interface Banner {
  title: string;
  subtitle: string;
  image?: string;
  ctaLabel?: string;
  href?: string;
}
export interface ProductPageResult {
  items: Product[];
  total: number;
  page: number;
  pages: number;
}
export interface Content {
  key: string;
  value: Slide[] | About | Banner;
}
export const money = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
