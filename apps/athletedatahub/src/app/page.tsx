import Link from "next/link";
import { ArrowRight, Truck, Users, Zap } from "lucide-react";
import { getFeaturedProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/Button";
import { t, getLocale } from "@/lib/i18n";

export default function HomePage() {
  const featuredProducts = getFeaturedProducts(8);
  const locale = getLocale();

  const categories = [
    {
      key: "clothing" as const,
      label: t("clothing"),
      href: "/catalog/clothing",
      emoji: "👕",
      color: "bg-indigo-50 border-indigo-200 hover:border-indigo-400",
      textColor: "text-indigo-700",
      desc:
        locale === "fr"
          ? "T-shirts, leggings, hoodies & plus"
          : "T-shirts, leggings, hoodies & more",
    },
    {
      key: "equipment" as const,
      label: t("equipment"),
      href: "/catalog/equipment",
      emoji: "🏋️",
      color: "bg-orange-50 border-orange-200 hover:border-orange-400",
      textColor: "text-orange-700",
      desc:
        locale === "fr"
          ? "Haltères, tapis, accessoires & plus"
          : "Dumbbells, mats, accessories & more",
    },
    {
      key: "nutrition" as const,
      label: t("nutrition"),
      href: "/catalog/nutrition",
      emoji: "💊",
      color: "bg-green-50 border-green-200 hover:border-green-400",
      textColor: "text-green-700",
      desc:
        locale === "fr"
          ? "Protéines, créatine, vitamines & plus"
          : "Proteins, creatine, vitamins & more",
    },
  ];

  const features = [
    {
      icon: Truck,
      title: t("freeShipping"),
      desc: t("freeShippingDesc"),
    },
    {
      icon: Users,
      title: t("expertAdvice"),
      desc: t("expertAdviceDesc"),
    },
    {
      icon: Zap,
      title: t("fastDelivery"),
      desc: t("fastDeliveryDesc"),
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-4">
              {t("heroTitle")}
            </h1>
            <p className="text-lg md:text-xl text-blue-200 mb-8 max-w-xl">
              {t("heroSubtitle")}
            </p>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              <Link href="/catalog">
                <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-bold">
                  {t("shopNow")}
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/catalog/nutrition">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                  {t("nutrition")}
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex-shrink-0 text-[120px] md:text-[180px] select-none leading-none">
            🏆
          </div>
        </div>
      </section>

      {/* Category Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {t("shopByCategory")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.key}
              href={cat.href}
              className={`group rounded-2xl border-2 p-6 transition-all ${cat.color} flex flex-col gap-3`}
            >
              <span className="text-5xl">{cat.emoji}</span>
              <div>
                <h3 className={`text-xl font-bold ${cat.textColor}`}>
                  {cat.label}
                </h3>
                <p className="text-sm text-gray-600 mt-1">{cat.desc}</p>
              </div>
              <span className={`text-sm font-semibold flex items-center gap-1 ${cat.textColor}`}>
                {t("shopNow")} <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {t("featuredProducts")}
          </h2>
          <Link
            href="/catalog"
            className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {t("catalog")} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Features / Trust bar */}
      <section className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
            {t("whyChooseUs")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="flex flex-col items-center text-center gap-3"
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
                    <Icon className="w-7 h-7 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{feat.title}</h3>
                  <p className="text-sm text-gray-500">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
