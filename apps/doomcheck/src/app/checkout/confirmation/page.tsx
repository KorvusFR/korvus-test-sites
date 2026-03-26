import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Order Confirmed",
};

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; total?: string }>;
}) {
  const { order, total } = await searchParams;

  const orderNumber = order ?? "DC-000000";
  const totalAmount = total ? parseFloat(total) : 0;

  const formatted = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(totalAmount);

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 text-center">
      <div className="flex justify-center mb-4">
        <CheckCircle className="w-16 h-16 text-doom-green" />
      </div>

      <h1 className="text-2xl font-bold text-slate-100 mb-2">
        Order Confirmed
      </h1>
      <p className="text-doom-400 mb-6">
        Signal received. Your order has been processed (in the void).
      </p>

      <div className="bg-doom-800 border border-doom-700 rounded-lg p-6 mb-8 text-left space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-doom-400">Order number</span>
          <span className="text-slate-200 font-mono">{orderNumber}</span>
        </div>
        {totalAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-doom-400">Total charged</span>
            <span className="text-doom-red font-semibold">{formatted}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-doom-400">Payment</span>
          <span className="text-doom-green font-mono text-xs">SIMULATED</span>
        </div>
      </div>

      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-doom-red text-white font-bold px-6 py-3 rounded-md hover:bg-red-600 transition-colors"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
