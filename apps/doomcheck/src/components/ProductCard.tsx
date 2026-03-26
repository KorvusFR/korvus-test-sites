import Link from "next/link";
import type { Product } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { ProductImage } from "@/components/ProductImage";
import { formatPrice } from "@/lib/utils";

interface Props {
  product: Product;
}

export function ProductCard({ product }: Props) {
  const stars = Math.round(product.rating);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block bg-doom-800 border border-doom-700 rounded-lg overflow-hidden hover:border-doom-red transition-colors duration-200"
    >
      <ProductImage
        category={product.category}
        name={product.name}
        className="w-full h-48"
      />

      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-200 line-clamp-2 group-hover:text-doom-red transition-colors">
            {product.name}
          </h3>
          {!product.inStock && (
            <Badge variant="danger" className="shrink-0">
              Out of stock
            </Badge>
          )}
        </div>

        <p className="text-xs text-doom-400 line-clamp-2">{product.description}</p>

        <div className="flex items-center gap-1 text-xs text-yellow-400">
          {"★".repeat(stars)}
          {"☆".repeat(5 - stars)}
          <span className="text-doom-400 ml-1">({product.reviewCount})</span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-doom-red font-bold text-base">
            {formatPrice(product.price)}
          </span>
          <span className="text-xs text-doom-400 font-mono capitalize">
            {product.category}
          </span>
        </div>
      </div>
    </Link>
  );
}
