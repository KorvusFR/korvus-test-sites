export type Category =
  | "software"
  | "hardware"
  | "managed-services"
  | "infrastructure";

export type LicenseType = "annual" | "perpetual" | "monthly";
export type DeliveryType = "digital" | "physical" | "service";

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
  licenseType: LicenseType;
  deliveryType: DeliveryType;
  variants: string[];
  featured: boolean;
}

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  selectedVariant?: string;
  licenseType: LicenseType;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  authorRole: string;
  publishedAt: string;
  readingTime: number;
  tags: string[];
  category: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  orderNumber: string;
  items: OrderItem[];
  total: number;
}
