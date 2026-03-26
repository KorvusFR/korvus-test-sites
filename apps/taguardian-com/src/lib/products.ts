import rawProducts from "../../data/products.json";
import type { Product, Category } from "@/types";

const products = rawProducts as Product[];

export function getAllProducts(): Product[] {
  return products;
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(category: Category): Product[] {
  return products.filter((p) => p.category === category);
}

export function getFeaturedProducts(count = 6): Product[] {
  return products.filter((p) => p.featured).slice(0, count);
}

export function getRelatedProducts(product: Product, count = 3): Product[] {
  return products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, count);
}

export function getAllCategories(): Category[] {
  return ["software", "hardware", "managed-services", "infrastructure"];
}

export const categoryMeta: Record<
  Category,
  { label: string; description: string; icon: string }
> = {
  software: {
    label: "Security Software",
    description: "Enterprise endpoint, SIEM, EDR, and identity licenses",
    icon: "💻",
  },
  hardware: {
    label: "Hardware & Appliances",
    description: "NGFW, HSMs, encrypted storage, and enterprise servers",
    icon: "🖥️",
  },
  "managed-services": {
    label: "Managed Services",
    description: "SOC, MDR, penetration testing, and advisory services",
    icon: "🛡️",
  },
  infrastructure: {
    label: "Infrastructure & Cloud",
    description: "VPN, SASE, WAF, backup, and automation platforms",
    icon: "☁️",
  },
};
