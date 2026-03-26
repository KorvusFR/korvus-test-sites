import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getLocale } from "@/lib/i18n";

export default function NotFound() {
  const locale = getLocale();
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center flex flex-col items-center gap-5">
      <p className="text-8xl font-extrabold text-gray-200">404</p>
      <h2 className="text-2xl font-bold text-gray-900">
        {locale === "fr" ? "Page introuvable" : "Page Not Found"}
      </h2>
      <p className="text-gray-500">
        {locale === "fr"
          ? "Cette page n'existe pas ou a été déplacée."
          : "This page doesn't exist or has been moved."}
      </p>
      <Link href="/">
        <Button size="lg">
          {locale === "fr" ? "Retour à l'accueil" : "Back to Home"}
        </Button>
      </Link>
    </div>
  );
}
