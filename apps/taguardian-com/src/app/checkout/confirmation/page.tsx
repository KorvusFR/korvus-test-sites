import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Order Confirmed" };

interface PageProps {
  searchParams: Promise<{ order?: string }>;
}

export default async function ConfirmationPage({ searchParams }: PageProps) {
  const { order } = await searchParams;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-emerald-500" />
        </div>

        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">
            Order Confirmed
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Thank you for your purchase. Our team will be in touch within 24 hours to begin onboarding.
          </p>
        </div>

        {order && (
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-8 py-5 w-full">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Order Reference</p>
            <p className="text-2xl font-bold text-brand-700 dark:text-brand-400 tracking-widest font-mono">
              {order}
            </p>
          </div>
        )}

        <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-5 w-full text-left space-y-2">
          <div className="flex items-center gap-2 font-semibold text-brand-800 dark:text-brand-300 text-sm">
            <FileText className="w-4 h-4" />
            Next steps
          </div>
          <ul className="text-sm text-brand-700 dark:text-brand-400 space-y-1 list-disc list-inside">
            <li>Order confirmation email sent to your business address</li>
            <li>Dedicated TAM assigned within 4 business hours</li>
            <li>Onboarding call scheduled within 24 hours</li>
            <li>License keys / hardware dispatch within 2 business days</li>
          </ul>
        </div>

        <Link href="/catalog">
          <Button size="lg">Continue Browsing</Button>
        </Link>
      </div>
    </div>
  );
}
