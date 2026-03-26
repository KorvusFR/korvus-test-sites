import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Star, Download, Truck, ShieldCheck, Clock } from "lucide-react";
import { getProductBySlug, getAllProducts, getRelatedProducts, categoryMeta } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProductOptions } from "@/components/ProductOptions";
import { Badge } from "@/components/ui/Badge";
import { formatPrice } from "@/lib/utils";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllProducts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  return { title: product?.name ?? "Product" };
}

const licenseLabels: Record<string, string> = {
  annual: "Annual subscription",
  perpetual: "Perpetual license",
  monthly: "Monthly subscription",
};

const deliveryLabels: Record<string, { label: string; icon: typeof Download }> = {
  digital: { label: "Digital delivery", icon: Download },
  physical: { label: "Physical shipment", icon: Truck },
  service: { label: "Professional service", icon: ShieldCheck },
};

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const related = getRelatedProducts(product, 3);
  const meta = categoryMeta[product.category];
  const delivery = deliveryLabels[product.deliveryType];
  const DeliveryIcon = delivery.icon;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Catalogue", href: "/catalog" },
          { label: meta.label, href: `/catalog/${product.category}` },
          { label: product.name },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-2">
        {/* Visual panel */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-brand-900 flex items-center justify-center aspect-square relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
          <div className="relative text-center">
            <span className="text-[120px] leading-none select-none">{meta.icon}</span>
            <p className="text-slate-400 text-sm mt-2 font-mono">{product.id.padStart(3, "0")}</p>
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">{meta.label}</Badge>
            <Badge variant="default">{licenseLabels[product.licenseType]}</Badge>
            {product.inStock ? (
              <Badge variant="success">In Stock</Badge>
            ) : (
              <Badge variant="danger">Out of Stock</Badge>
            )}
          </div>

          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
            {product.name}
          </h1>

          {/* Rating */}
          <div className="flex items-center gap-2">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.rating) ? "fill-amber-400 text-amber-400" : i < product.rating ? "fill-amber-200 text-amber-400" : "text-slate-200 dark:text-slate-700"}`} />
              ))}
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{product.rating}</span>
            <span className="text-sm text-slate-400">({product.reviewCount} reviews)</span>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-brand-700 dark:text-brand-400">
              {formatPrice(product.price)}
            </span>
            {product.licenseType !== "perpetual" && (
              <span className="text-slate-400 text-sm">/{product.licenseType === "annual" ? "year" : "month"}</span>
            )}
          </div>

          <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
            {product.description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {product.tags.map((tag) => (
              <Badge key={tag} variant="default">{tag}</Badge>
            ))}
          </div>

          {/* Variants + CTA */}
          <ProductOptions product={product} />

          {/* Delivery / trust */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <DeliveryIcon className="w-4 h-4 text-brand-500 flex-shrink-0" />
              {delivery.label}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-brand-500 flex-shrink-0" />
              Vendor-certified
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Clock className="w-4 h-4 text-brand-500 flex-shrink-0" />
              30-day return policy
            </div>
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">Related Solutions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
