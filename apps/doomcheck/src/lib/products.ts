import productsData from "../data/products.json";
import type { Product, Category } from "@/types";

const products = productsData as Product[];

export function getAllProducts(): Product[] {
  return products;
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(category: Category): Product[] {
  return products.filter((p) => p.category === category);
}

export function getFeaturedProducts(count = 8): Product[] {
  return [...products]
    .filter((p) => p.featured || p.rating >= 4.7)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, count);
}

export function getRelatedProducts(product: Product, count = 4): Product[] {
  return products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, count);
}

export function getAllCategories(): Category[] {
  return ["phones", "audio", "gaming", "laptops", "accessories"];
}

export const categoryMeta: Record<
  Category,
  { label: string; description: string; icon: string }
> = {
  phones: {
    label: "Phones & Tablets",
    description: "Smartphones and tablets for the signal-aware",
    icon: "📱",
  },
  audio: {
    label: "Audio",
    description: "Headphones, earbuds, and speakers engineered for the underground",
    icon: "🎧",
  },
  gaming: {
    label: "Gaming",
    description: "Controllers, keyboards, and gear for the long descent",
    icon: "🎮",
  },
  laptops: {
    label: "Laptops & Displays",
    description: "Machines and monitors built to handle maximum entropy",
    icon: "💻",
  },
  accessories: {
    label: "Accessories",
    description: "Cables, drives, and tools to extend your arsenal",
    icon: "🔌",
  },
};
