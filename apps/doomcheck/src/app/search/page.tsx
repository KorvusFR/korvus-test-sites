import type { Metadata } from "next";
import { getAllProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Search",
  description: "Search products on doomcheck.me",
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">
          {query ? `Results for "${query}"` : "Search"}
        </h1>
        {query && (
          <p className="search-results-count text-doom-400 text-sm">
            {results.length} items found
          </p>
        )}
      </div>

      {!query && (
        <div className="text-center py-16 text-doom-500">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Type something to search…</p>
        </div>
      )}

      {query && results.length === 0 && (
        <div className="text-center py-16" data-search-no-results>
          <Search className="w-12 h-12 mx-auto mb-4 text-doom-600" />
          <p className="text-lg font-medium text-slate-300">No results</p>
          <p className="text-sm text-doom-400 mt-1">No products match your search.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
