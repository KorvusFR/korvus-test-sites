import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getProductBySlug,
  getAllProducts,
  getRelatedProducts,
  categoryMeta,
} from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductImage } from "@/components/ProductImage";
import { Badge } from "@/components/ui/Badge";
import { formatPrice } from "@/lib/utils";
import { ViewItemTracker } from "@/components/ViewItemTracker";

export function generateStaticParams() {
  return getAllProducts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };
  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) notFound();

  const related = getRelatedProducts(product, 4);
  const meta = categoryMeta[product.category];
  const stars = Math.round(product.rating);

  // Intentionally broken JSON-LD for glitchphone-9: missing price and availability
  const isBrokenLd = product.slug === "glitchphone-9";
  const jsonLd = isBrokenLd
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        sku: product.id,
        description: product.description,
        offers: {
          "@type": "Offer",
          priceCurrency: "EUR",
        },
      }
    : {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        sku: product.id,
        description: product.description,
        image: `https://doomcheck.com/products/${product.slug}`,
        offers: {
          "@type": "Offer",
          price: product.price,
          priceCurrency: "EUR",
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
        name={product.name}
        category={product.category}
        price={product.price}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <nav className="text-xs text-doom-400 mb-6">
        <Link href="/catalog" className="hover:text-doom-red transition-colors">
          Catalog
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/catalog/${product.category}`}
          className="hover:text-doom-red transition-colors"
        >
          {meta.label}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-300">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <ProductImage
          category={product.category}
          name={product.name}
          className="w-full aspect-square rounded-lg"
        />

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="default" className="font-mono">
              {meta.icon} {meta.label}
            </Badge>
            {!product.inStock && <Badge variant="danger">Out of Stock</Badge>}
            {product.featured && <Badge variant="doom">Top Rated</Badge>}
          </div>

          <h1 className="text-2xl font-bold text-slate-100">{product.name}</h1>

          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-sm">
              {"★".repeat(stars)}{"☆".repeat(5 - stars)}
            </span>
            <span className="text-sm text-doom-400">
              {product.rating} ({product.reviewCount} reviews)
            </span>
          </div>

          <p className="text-doom-400 leading-relaxed">{product.description}</p>

          <div className="text-3xl font-bold text-doom-red">
            {formatPrice(product.price)}
          </div>

          {product.variants.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Options
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <span
                    key={v}
                    className="px-3 py-1 rounded-md text-sm bg-doom-800 border border-doom-600 text-slate-300"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {product.colors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Colors
              </p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <span
                    key={c}
                    className="px-3 py-1 rounded-md text-sm bg-doom-800 border border-doom-600 text-slate-300"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            <AddToCartButton
              product={product}
              selectedVariant={product.variants[0]}
              selectedColor={product.colors[0]}
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-2 text-xs text-doom-400">
            {product.tags.map((tag) => (
              <span key={tag} className="bg-doom-800 px-2 py-1 rounded font-mono">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-200 mb-4">
            More in {meta.label}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
