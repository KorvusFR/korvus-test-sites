import type { Metadata } from "next";
import { getAllProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Search",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  const results = query
    ? getAllProducts().filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Search" }]}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {query ? `Results for "${query}"` : "Search"}
        </h1>
        {query && (
          <p className="text-sm text-slate-500 mt-1">
            {results.length} products
          </p>
        )}
      </div>

      {!query && (
        <div className="text-center py-16 text-slate-400">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Search for security solutions…</p>
        </div>
      )}

      {query && results.length === 0 && (
        <div className="text-center py-16" data-search-no-results>
          <Search className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
          <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No results</p>
          <p className="text-sm text-slate-500 mt-1">No products match your search.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
