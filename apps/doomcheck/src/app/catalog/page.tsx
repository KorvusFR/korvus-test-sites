import type { Metadata } from "next";
import { getAllProducts, categoryMeta, getAllCategories } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Catalog",
  description: "Browse all electronics and gadgets at doomcheck.me",
};

export default function CatalogPage() {
  const products = getAllProducts();
  const categories = getAllCategories();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">All Products</h1>
        <p className="text-doom-400 text-sm">{products.length} items across all categories</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href="/catalog"
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-doom-red text-white"
        >
          All
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat}
            href={`/catalog/${cat}`}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-doom-800 border border-doom-700 text-slate-300 hover:border-doom-red hover:text-doom-red transition-colors"
          >
            {categoryMeta[cat].icon} {categoryMeta[cat].label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
