export type Category = "clothing" | "equipment" | "nutrition";

export interface Product {
  id: string;
  slug: string;
  category: Category;
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  price: number;
  priceFr: number;
  image: string;
  tags: string[];
  inStock: boolean;
  rating: number;
  reviewCount: number;
  variants: string[];
  colors: string[];
}

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  nameFr: string;
  price: number;
  priceFr: number;
  image: string;
  quantity: number;
  selectedVariant?: string;
  selectedColor?: string;
}

export interface CartState {
  items: CartItem[];
  total: number;
}
