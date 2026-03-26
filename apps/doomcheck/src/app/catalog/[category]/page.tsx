import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getProductsByCategory,
  categoryMeta,
  getAllCategories,
} from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import type { Category } from "@/types";

export function generateStaticParams() {
  return getAllCategories().map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const meta = categoryMeta[category as Category];
  if (!meta) return { title: "Category" };
  return {
    title: meta.label,
    description: meta.description,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;

  const validCategories = getAllCategories() as string[];
  if (!validCategories.includes(category)) notFound();

  const cat = category as Category;
  const products = getProductsByCategory(cat);
  const meta = categoryMeta[cat];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-2">
        <nav className="text-xs text-doom-400 mb-4">
          <Link href="/catalog" className="hover:text-doom-red transition-colors">
            Catalog
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">{meta.label}</span>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{meta.label}</h1>
            <p className="text-doom-400 text-sm">{meta.description}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 my-6">
        <Link
          href="/catalog"
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-doom-800 border border-doom-700 text-slate-300 hover:border-doom-red hover:text-doom-red transition-colors"
        >
          All
        </Link>
        {getAllCategories().map((c) => (
          <Link
            key={c}
            href={`/catalog/${c}`}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              c === cat
                ? "bg-doom-red text-white"
                : "bg-doom-800 border border-doom-700 text-slate-300 hover:border-doom-red hover:text-doom-red"
            }`}
          >
            {categoryMeta[c].icon} {categoryMeta[c].label}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20 text-doom-400">
          <p>No products found in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
