import type { Metadata } from "next";
import Link from "next/link";
import { getAllProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Catalog",
};

export default function CatalogPage() {
  const products = getAllProducts();

  const categoryLinks: { href: string; label: string; count: number }[] = [
    {
      href: "/catalog/clothing",
      label: t("clothing"),
      count: products.filter((p) => p.category === "clothing").length,
    },
    {
      href: "/catalog/equipment",
      label: t("equipment"),
      count: products.filter((p) => p.category === "equipment").length,
    },
    {
      href: "/catalog/nutrition",
      label: t("nutrition"),
      count: products.filter((p) => p.category === "nutrition").length,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs
        items={[
          { label: t("home"), href: "/" },
          { label: t("catalog") },
        ]}
      />

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-56 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">{t("categories")}</h3>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/catalog"
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium text-sm"
                >
                  <span>{t("allCategories")}</span>
                  <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full">
                    {products.length}
                  </span>
                </Link>
              </li>
              {categoryLinks.map((cat) => (
                <li key={cat.href}>
                  <Link
                    href={cat.href}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 text-sm transition-colors"
                  >
                    <span>{cat.label}</span>
                    <span className="text-xs text-gray-400">{cat.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl font-bold text-gray-900">{t("catalog")}</h1>
            <p className="text-sm text-gray-500">
              {t("showing")} {products.length} {t("products")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
