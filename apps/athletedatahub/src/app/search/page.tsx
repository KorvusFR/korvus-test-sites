import type { Metadata } from "next";
import { getAllProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { t, getLocale } from "@/lib/i18n";
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
  const locale = getLocale();

  const results = query
    ? getAllProducts().filter((p) => {
        const name = locale === "fr" ? p.nameFr : p.name;
        return name.toLowerCase().includes(query.toLowerCase());
      })
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs
        items={[
          { label: t("home"), href: "/" },
          { label: t("searchResults") },
        ]}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {query ? `${t("searchResultsFor")} "${query}"` : t("searchResults")}
        </h1>
        {query && (
          <p className="text-sm text-gray-500 mt-1">
            {results.length} {t("products")}
          </p>
        )}
      </div>

      {!query && (
        <div className="text-center py-16 text-gray-400">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">{t("searchPlaceholder")}</p>
        </div>
      )}

      {query && results.length === 0 && (
        <div className="text-center py-16" data-search-no-results>
          <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-700">{t("noResults")}</p>
          <p className="text-sm text-gray-500 mt-1">{t("noResultsMessage")}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
