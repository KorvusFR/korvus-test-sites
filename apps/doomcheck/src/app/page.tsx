import Link from "next/link";
import { getFeaturedProducts, categoryMeta, getAllCategories } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { Zap, Shield, Truck, RotateCcw } from "lucide-react";

export default function HomePage() {
  const featured = getFeaturedProducts(8);
  const categories = getAllCategories();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-doom-900 border-b border-doom-700">
        {/* Heavy hero image — LCP element for perf_drop testing */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-chaos.jpg"
          alt="doomcheck chaos hero"
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-doom-red/10 via-transparent to-doom-green/5 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-28 relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-doom-800 border border-doom-700 rounded-full px-3 py-1 text-xs text-doom-green font-mono mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-doom-green animate-pulse" />
              CHAOS LAB ACTIVE
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-100 leading-tight mb-4">
              Electronics for those who{" "}
              <span className="text-doom-red">operate at the edge</span>
            </h1>
            <p className="text-lg text-doom-400 mb-8">
              30 gadgets. 5 categories. Chaos flags ready. doomcheck.me is the
              test ground where snippets come to prove themselves.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 bg-doom-red text-white font-bold text-base px-6 py-3 rounded-md hover:bg-red-600 transition-colors"
              >
                <Zap className="w-4 h-4" />
                Browse Catalog
              </Link>
              <Link
                href="/catalog/gaming"
                className="inline-flex items-center gap-2 bg-doom-800 border border-doom-600 text-slate-200 font-semibold text-base px-6 py-3 rounded-md hover:border-doom-red hover:text-doom-red transition-colors"
              >
                Gaming Gear
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-xs font-semibold text-doom-400 uppercase tracking-widest mb-6">
          Categories
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {categories.map((cat) => {
            const meta = categoryMeta[cat];
            return (
              <Link
                key={cat}
                href={`/catalog/${cat}`}
                className="group flex flex-col items-center gap-2 bg-doom-800 border border-doom-700 hover:border-doom-red rounded-lg p-4 transition-colors text-center"
              >
                <span className="text-3xl">{meta.icon}</span>
                <span className="text-xs font-semibold text-slate-300 group-hover:text-doom-red transition-colors">
                  {meta.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-200">Top Rated</h2>
          <Link
            href="/catalog"
            className="text-sm text-doom-red hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-t border-doom-700 bg-doom-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {[
              {
                icon: <Truck className="w-5 h-5 mx-auto mb-2 text-doom-red" />,
                title: "Simulated Shipping",
                desc: "No real deliveries — it's a test env",
              },
              {
                icon: <Shield className="w-5 h-5 mx-auto mb-2 text-doom-red" />,
                title: "Fake Payments",
                desc: "No real money moves in the void",
              },
              {
                icon: (
                  <RotateCcw className="w-5 h-5 mx-auto mb-2 text-doom-red" />
                ),
                title: "Chaos-Ready",
                desc: "Feature flags for controlled entropy",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="py-2">
                {icon}
                <p className="text-sm font-semibold text-slate-300">{title}</p>
                <p className="text-xs text-doom-400 mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
