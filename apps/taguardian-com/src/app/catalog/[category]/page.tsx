import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getProductsByCategory,
  getAllCategories,
  getAllProducts,
  categoryMeta,
} from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import type { Category } from "@/types";

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return getAllCategories().map((category) => ({ category }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const meta = categoryMeta[category as Category];
  return { title: meta?.label ?? "Category" };
}

const VALID: Category[] = ["software", "hardware", "managed-services", "infrastructure"];

export default async function CategoryPage({ params }: PageProps) {
  const { category } = await params;
  if (!VALID.includes(category as Category)) notFound();

  const cat = category as Category;
  const products = getProductsByCategory(cat);
  const allProducts = getAllProducts();
  const allCats = getAllCategories();
  const meta = categoryMeta[cat];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Catalogue", href: "/catalog" }, { label: meta.label }]} />

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-60 flex-shrink-0">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 sticky top-20">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 text-sm">Solution Areas</h3>
            <ul className="space-y-1">
              <li>
                <Link href="/catalog" className="flex items-center justify-between px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm transition-colors">
                  <span>All Solutions</span>
                  <span className="text-xs text-slate-400">{allProducts.length}</span>
                </Link>
              </li>
              {allCats.map((c) => {
                const count = allProducts.filter((p) => p.category === c).length;
                const isActive = c === cat;
                return (
                  <li key={c}>
                    <Link href={`/catalog/${c}`} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                      <span>{categoryMeta[c].label}</span>
                      <span className={`text-xs ${isActive ? "bg-brand-100 dark:bg-brand-900/50 px-2 py-0.5 rounded-full" : "text-slate-400"}`}>{count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0">
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{meta.label}</h1>
              <p className="text-sm text-slate-500">{products.length} products</p>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{meta.description}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
