import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductsByCategory, getAllCategories } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { t, getLocale } from "@/lib/i18n";
import type { Category } from "@/types";

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return getAllCategories().map((category) => ({ category }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const categoryLabels: Record<string, string> = {
    clothing: "Clothing",
    equipment: "Equipment",
    nutrition: "Nutrition",
  };
  return { title: categoryLabels[category] ?? "Category" };
}

const categoryLabels: Record<string, { en: string; fr: string }> = {
  clothing: { en: "Clothing", fr: "Vêtements" },
  equipment: { en: "Equipment", fr: "Équipements" },
  nutrition: { en: "Nutrition", fr: "Nutrition" },
};

export default async function CategoryPage({ params }: PageProps) {
  const { category } = await params;
  const locale = getLocale();

  if (!["clothing", "equipment", "nutrition"].includes(category)) {
    notFound();
  }

  const validCategory = category as Category;
  const products = getProductsByCategory(validCategory);
  const catLabel =
    categoryLabels[validCategory]?.[locale] ?? validCategory;

  const otherCategories = (["clothing", "equipment", "nutrition"] as Category[]).filter(
    (c) => c !== validCategory
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs
        items={[
          { label: t("home"), href: "/" },
          { label: t("catalog"), href: "/catalog" },
          { label: catLabel },
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
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 text-sm transition-colors"
                >
                  {t("allCategories")}
                </Link>
              </li>
              <li>
                <span className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium text-sm">
                  <span>{catLabel}</span>
                  <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full">
                    {products.length}
                  </span>
                </span>
              </li>
              {otherCategories.map((cat) => {
                const label = categoryLabels[cat]?.[locale] ?? cat;
                return (
                  <li key={cat}>
                    <Link
                      href={`/catalog/${cat}`}
                      className="flex items-center px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 text-sm transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl font-bold text-gray-900">{catLabel}</h1>
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
