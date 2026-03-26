import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { t } from "@/lib/i18n";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-xl text-white mb-3"
            >
              <Dumbbell className="w-6 h-6 text-blue-400" />
              <span>AthleteDataHub</span>
            </Link>
            <p className="text-sm text-gray-400">{t("footerTagline")}</p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-white mb-3">{t("quickLinks")}</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-sm hover:text-white transition-colors"
                >
                  {t("home")}
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog"
                  className="text-sm hover:text-white transition-colors"
                >
                  {t("catalog")}
                </Link>
              </li>
              <li>
                <Link
                  href="/cart"
                  className="text-sm hover:text-white transition-colors"
                >
                  {t("cart")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-semibold text-white mb-3">{t("categories")}</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/catalog/clothing"
                  className="text-sm hover:text-white transition-colors"
                >
                  {t("clothing")}
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog/equipment"
                  className="text-sm hover:text-white transition-colors"
                >
                  {t("equipment")}
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog/nutrition"
                  className="text-sm hover:text-white transition-colors"
                >
                  {t("nutrition")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold text-white mb-3">{t("support")}</h3>
            <ul className="space-y-2">
              <li>
                <span className="text-sm cursor-default">{t("contactUs")}</span>
              </li>
              <li>
                <span className="text-sm cursor-default">{t("faq")}</span>
              </li>
              <li>
                <span className="text-sm cursor-default">{t("returns")}</span>
              </li>
              <li>
                <span className="text-sm cursor-default">{t("privacy")}</span>
              </li>
              <li>
                <span className="text-sm cursor-default">{t("terms")}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            &copy; {currentYear} AthleteDataHub. {t("allRightsReserved")}
          </p>
          <p className="text-xs text-gray-600">
            {process.env.NEXT_PUBLIC_LOCALE === "FR"
              ? "athletedatahub.fr"
              : "athletedatahub.com"}
          </p>
        </div>
      </div>
    </footer>
  );
}
