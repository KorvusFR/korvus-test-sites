import Link from "next/link";
import { Star } from "lucide-react";
import type { Product } from "@/types";
import { getLocale, formatPrice } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { AddToCartButton } from "@/components/AddToCartButton";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const locale = getLocale();
  const name = locale === "fr" ? product.nameFr : product.name;
  const price = formatPrice(product.price, product.priceFr);

  return (
    <div className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Image */}
      <Link href={`/products/${product.slug}`} className="block overflow-hidden">
        <div className="aspect-square bg-gray-100 relative flex items-center justify-center">
          <ProductImage category={product.category} />
          {!product.inStock && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <span className="bg-gray-800 text-white text-xs font-semibold px-3 py-1 rounded-full">
                {locale === "fr" ? "Rupture de stock" : "Out of Stock"}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/products/${product.slug}`}
            className="text-sm font-semibold text-gray-900 hover:text-blue-700 transition-colors line-clamp-2 leading-snug"
          >
            {name}
          </Link>
          <Badge variant="info" className="flex-shrink-0 capitalize text-xs">
            {locale === "fr"
              ? product.category === "clothing"
                ? "Vêtement"
                : product.category === "equipment"
                ? "Équipement"
                : "Nutrition"
              : product.category}
          </Badge>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1">
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${
                  i < Math.floor(product.rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : i < product.rating
                    ? "fill-yellow-200 text-yellow-400"
                    : "text-gray-300"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">({product.reviewCount})</span>
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-2">
          <span className="text-lg font-bold text-gray-900">{price}</span>
          <AddToCartButton product={product} size="sm" />
        </div>
      </div>
    </div>
  );
}

function ProductImage({ category }: { category: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    clothing: { bg: "bg-indigo-50", text: "text-indigo-400" },
    equipment: { bg: "bg-orange-50", text: "text-orange-400" },
    nutrition: { bg: "bg-green-50", text: "text-green-400" },
  };
  const style = colors[category] ?? { bg: "bg-gray-100", text: "text-gray-400" };

  const icons: Record<string, string> = {
    clothing: "👕",
    equipment: "🏋️",
    nutrition: "💊",
  };

  return (
    <div className={`w-full h-full flex items-center justify-center ${style.bg} group-hover:scale-105 transition-transform duration-300`}>
      <span className="text-6xl select-none">{icons[category] ?? "📦"}</span>
    </div>
  );
}
