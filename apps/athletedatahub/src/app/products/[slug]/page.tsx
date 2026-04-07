import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Star, Package, Shield } from "lucide-react";
import { getProductBySlug, getAllProducts, getRelatedProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Badge } from "@/components/ui/Badge";
import { t, getLocale, getCurrency, formatPrice } from "@/lib/i18n";
import { ProductOptions } from "@/components/ProductOptions";
import { ViewItemTracker } from "@/components/ViewItemTracker";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllProducts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };
  return {
    title: process.env.NEXT_PUBLIC_LOCALE === "FR" ? product.nameFr : product.name,
  };
}

const categoryLabels: Record<string, { en: string; fr: string }> = {
  clothing: { en: "Clothing", fr: "Vêtements" },
  equipment: { en: "Equipment", fr: "Équipements" },
  nutrition: { en: "Nutrition", fr: "Nutrition" },
};

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) notFound();

  const locale = getLocale();
  const name = locale === "fr" ? product.nameFr : product.name;
  const description = locale === "fr" ? product.descriptionFr : product.description;
  const price = formatPrice(product.price, product.priceFr);
  const catLabel = categoryLabels[product.category]?.[locale] ?? product.category;
  const related = getRelatedProducts(product, 4);
  const currency = getCurrency();
  const rawPrice = locale === "fr" ? product.priceFr : product.price;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    sku: product.id,
    description,
    image: product.image,
    offers: {
      "@type": "Offer",
      price: rawPrice,
      priceCurrency: currency,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ViewItemTracker
        id={product.id}
        name={name}
        category={product.category}
        price={rawPrice}
        currency={currency}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs
        items={[
          { label: t("home"), href: "/" },
          { label: t("catalog"), href: "/catalog" },
          { label: catLabel, href: `/catalog/${product.category}` },
          { label: name },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-2">
        {/* Product Image */}
        <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center">
          <ProductHero category={product.category} />
        </div>

        {/* Product Info */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="info" className="capitalize">{catLabel}</Badge>
            {product.inStock ? (
              <Badge variant="success">{t("inStock")}</Badge>
            ) : (
              <Badge variant="danger">{t("outOfStock")}</Badge>
            )}
          </div>

          <h1 className="text-3xl font-extrabold text-gray-900">{name}</h1>

          {/* Rating */}
          <div className="flex items-center gap-2">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-5 h-5 ${
                    i < Math.floor(product.rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : i < product.rating
                      ? "fill-yellow-200 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-gray-700">
              {product.rating}
            </span>
            <span className="text-sm text-gray-400">
              ({product.reviewCount} {t("reviews")})
            </span>
          </div>

          <div className="text-4xl font-extrabold text-blue-700">{price}</div>

          <p className="text-gray-600 leading-relaxed">{description}</p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <Badge key={tag} variant="default">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Options + CTA */}
          <ProductOptions product={product} />

          {/* Trust badges */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Package className="w-4 h-4 text-blue-500 flex-shrink-0" />
              {t("freeShippingDesc")}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />
              {locale === "fr"
                ? "Retours sous 30 jours"
                : "30-day easy returns"}
            </div>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {t("relatedProducts")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
    </>
  );
}

function ProductHero({ category }: { category: string }) {
  const configs: Record<string, { bg: string; emoji: string }> = {
    clothing: { bg: "bg-indigo-50", emoji: "👕" },
    equipment: { bg: "bg-orange-50", emoji: "🏋️" },
    nutrition: { bg: "bg-green-50", emoji: "💊" },
  };
  const { bg, emoji } = configs[category] ?? { bg: "bg-gray-100", emoji: "📦" };
  return (
    <div className={`w-full h-full flex items-center justify-center ${bg}`}>
      <span className="text-[180px] select-none leading-none">{emoji}</span>
    </div>
  );
}
