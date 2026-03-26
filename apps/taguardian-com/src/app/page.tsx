import Link from "next/link";
import { ArrowRight, Shield, Award, HeadphonesIcon, TrendingUp } from "lucide-react";
import { getFeaturedProducts, getAllCategories, categoryMeta } from "@/lib/products";
import { getAllPosts } from "@/lib/blog";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";

export default function HomePage() {
  const featured = getFeaturedProducts(6);
  const recentPosts = getAllPosts().slice(0, 3);
  const categories = getAllCategories();

  return (
    <>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "48px 48px" }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-brand-600/20 border border-brand-500/30 rounded-full px-4 py-1.5 text-brand-300 text-sm font-medium mb-6">
              <Shield className="w-4 h-4" />
              Enterprise Cybersecurity Marketplace
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-5">
              Defend Your Enterprise.<br />
              <span className="text-brand-400">At Scale.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-300 mb-8 max-w-2xl">
              Curated portfolio of enterprise-grade security software, hardened appliances, and
              managed services — sourced and validated by certified security architects.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/catalog">
                <Button size="lg" className="bg-brand-600 hover:bg-brand-500 text-white">
                  Browse Catalogue <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/catalog/managed-services">
                <Button size="lg" variant="outline" className="border-slate-600 text-slate-200 hover:bg-white/10 hover:border-slate-400">
                  Managed Services
                </Button>
              </Link>
            </div>
          </div>
        </div>
        {/* Floating stat cards */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: "100+", label: "Enterprise Products" },
              { value: "24/7", label: "SOC Coverage" },
              { value: "FIPS", label: "Certified Hardware" },
              { value: "ISO 27001", label: "Compliant Services" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center backdrop-blur">
                <p className="text-2xl font-extrabold text-white">{stat.value}</p>
                <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
          Solution Areas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const meta = categoryMeta[cat];
            return (
              <Link
                key={cat}
                href={`/catalog/${cat}`}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-600 rounded-xl p-5 transition-all hover:shadow-md flex flex-col gap-3"
              >
                <span className="text-3xl">{meta.icon}</span>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
                    {meta.label}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{meta.description}</p>
                </div>
                <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1 mt-auto">
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Featured Solutions
          </h2>
          <Link href="/catalog" className="text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Trust / Features */}
      <section className="bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Shield, title: "Vendor-Validated", desc: "Every product reviewed by certified security architects" },
              { icon: Award, title: "Enterprise SLAs", desc: "Contractual uptime and response commitments on all services" },
              { icon: HeadphonesIcon, title: "Dedicated TAM", desc: "Assigned technical account manager from day one" },
              { icon: TrendingUp, title: "Threat Intelligence", desc: "Continuously updated with latest adversary TTPs" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent blog posts */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Security Intelligence
          </h2>
          <Link href="/blog" className="text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
            All articles <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {recentPosts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700 rounded-xl p-5 transition-all hover:shadow-md flex flex-col gap-3"
            >
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{formatDate(post.publishedAt)}</span>
                <span>·</span>
                <span>{post.readingTime} min read</span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors line-clamp-2 text-sm leading-snug">
                {post.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed flex-1">
                {post.excerpt}
              </p>
              <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1">
                Read more <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
