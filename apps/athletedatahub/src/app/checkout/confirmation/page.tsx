import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { t, getLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Order Confirmed",
};

interface PageProps {
  searchParams: Promise<{ order?: string }>;
}

export default async function ConfirmationPage({ searchParams }: PageProps) {
  const { order } = await searchParams;
  const locale = getLocale();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>

        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
            {t("orderConfirmed")}
          </h1>
          <p className="text-gray-600">{t("orderThankYou")}</p>
        </div>

        {order && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 px-8 py-4 w-full">
            <p className="text-sm text-gray-500 mb-1">{t("orderNumber")}</p>
            <p className="text-2xl font-bold text-blue-700 tracking-wider font-mono">
              {order}
            </p>
          </div>
        )}

        <div className="bg-blue-50 rounded-xl p-5 w-full text-left space-y-2">
          <div className="flex items-center gap-2 font-semibold text-blue-800">
            <Package className="w-5 h-5" />
            {locale === "fr"
              ? "Que se passe-t-il ensuite ?"
              : "What happens next?"}
          </div>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            {locale === "fr" ? (
              <>
                <li>Vous recevrez un email de confirmation sous peu</li>
                <li>Votre commande sera expédiée sous 1-2 jours ouvrés</li>
                <li>Livraison estimée en 2-3 jours ouvrés</li>
              </>
            ) : (
              <>
                <li>You will receive a confirmation email shortly</li>
                <li>Your order will be shipped within 1-2 business days</li>
                <li>Estimated delivery in 2-3 business days</li>
              </>
            )}
          </ul>
        </div>

        <Link href="/catalog">
          <Button size="lg">{t("continueBrowsing")}</Button>
        </Link>
      </div>
    </div>
  );
}
