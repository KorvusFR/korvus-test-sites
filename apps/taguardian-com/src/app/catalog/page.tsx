import type { Metadata } from "next";
import Link from "next/link";
import { getAllProducts, getAllCategories, categoryMeta } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Catalogue" };

export default function CatalogPage() {
  const products = getAllProducts();
  const categories = getAllCategories();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Catalogue" }]} />

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-60 flex-shrink-0">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 sticky top-20">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 text-sm">Solution Areas</h3>
            <ul className="space-y-1">
              <li>
                <Link href="/catalog" className="flex items-center justify-between px-3 py-2 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium text-sm">
                  <span>All Solutions</span>
                  <span className="text-xs bg-brand-100 dark:bg-brand-900/50 px-2 py-0.5 rounded-full">{products.length}</span>
                </Link>
              </li>
              {categories.map((cat) => {
                const count = products.filter((p) => p.category === cat).length;
                return (
                  <li key={cat}>
                    <Link href={`/catalog/${cat}`} className="flex items-center justify-between px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm transition-colors">
                      <span>{categoryMeta[cat].label}</span>
                      <span className="text-xs text-slate-400">{count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Price range overview */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-2">Price Range</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {formatPrice(200)} – {formatPrice(5000)}
              </p>
            </div>
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">All Solutions</h1>
            <p className="text-sm text-slate-500">{products.length} products</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
