export type Category = "phones" | "audio" | "gaming" | "laptops" | "accessories";

export interface Product {
  id: string;
  slug: string;
  category: Category;
  name: string;
  description: string;
  price: number;
  tags: string[];
  inStock: boolean;
  rating: number;
  reviewCount: number;
  variants: string[];
  colors: string[];
  featured?: boolean;
}

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  selectedVariant?: string;
  selectedColor?: string;
}

export interface CartState {
  items: CartItem[];
  total: number;
}
