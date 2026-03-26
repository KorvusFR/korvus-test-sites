import Link from "next/link";
import { Star, Package, Server, Settings } from "lucide-react";
import type { Product } from "@/types";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { AddToCartButton } from "@/components/AddToCartButton";

const licenseLabels: Record<string, string> = {
  annual: "Annual",
  perpetual: "One-time",
  monthly: "Monthly",
};

function CategoryIcon({ category }: { category: string }) {
  if (category === "software") return <Settings className="w-4 h-4" />;
  if (category === "hardware") return <Server className="w-4 h-4" />;
  return <Package className="w-4 h-4" />;
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <div className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all flex flex-col overflow-hidden">
      {/* Top band */}
      <div className="h-2 bg-gradient-to-r from-brand-600 to-brand-400 dark:from-brand-700 dark:to-brand-500" />

      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Category + license */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="info" className="flex items-center gap-1">
            <CategoryIcon category={product.category} />
            {product.category === "managed-services" ? "Services" : product.category.charAt(0).toUpperCase() + product.category.slice(1)}
          </Badge>
          <Badge variant="default">{licenseLabels[product.licenseType]}</Badge>
          {!product.inStock && <Badge variant="danger">Out of Stock</Badge>}
        </div>

        {/* Name */}
        <Link
          href={`/products/${product.slug}`}
          className="font-semibold text-slate-900 dark:text-slate-100 hover:text-brand-700 dark:hover:text-brand-400 transition-colors line-clamp-2 leading-snug text-sm"
        >
          {product.name}
        </Link>

        {/* Description */}
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed flex-1">
          {product.description}
        </p>

        {/* Rating */}
        <div className="flex items-center gap-1.5">
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${
                  i < Math.floor(product.rating)
                    ? "fill-amber-400 text-amber-400"
                    : i < product.rating
                    ? "fill-amber-200 text-amber-400"
                    : "text-slate-200 dark:text-slate-700"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            ({product.reviewCount})
          </span>
        </div>

        {/* Price + CTA */}
        <div className="flex items-end justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 mt-auto">
          <div>
            <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              {formatPrice(product.price)}
            </span>
            {product.licenseType !== "perpetual" && (
              <span className="text-xs text-slate-400 ml-1">
                /{product.licenseType === "annual" ? "yr" : "mo"}
              </span>
            )}
          </div>
          <AddToCartButton product={product} size="sm" />
        </div>
      </div>
    </div>
  );
}
