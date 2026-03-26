"use client";

import Link from "next/link";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { formatPrice } from "@/lib/utils";

const licenseLabels: Record<string, string> = {
  annual: "/yr",
  perpetual: "",
  monthly: "/mo",
};

export function CartView() {
  const { items, total, removeItem, updateQuantity } = useCart();

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
        <div className="flex flex-col items-center justify-center py-24 gap-5">
          <ShoppingBag className="w-20 h-20 text-slate-200 dark:text-slate-700" />
          <h2 className="text-2xl font-bold text-slate-600 dark:text-slate-400">Your cart is empty</h2>
          <Link href="/catalog"><Button size="lg">Browse Solutions</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Your Cart</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Items */}
        <div className="flex-1 min-w-0 space-y-3">
          {items.map((item) => (
            <div key={item.productId} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-slate-700 to-brand-900 flex items-center justify-center flex-shrink-0 text-2xl select-none">
                🛡️
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/products/${item.slug}`} className="font-semibold text-sm text-slate-900 dark:text-slate-100 hover:text-brand-700 dark:hover:text-brand-400 line-clamp-2">
                  {item.name}
                </Link>
                {item.selectedVariant && (
                  <p className="text-xs text-slate-500 mt-0.5">Plan: {item.selectedVariant}</p>
                )}
                <p className="text-brand-700 dark:text-brand-400 font-bold mt-1 text-sm">
                  {formatPrice(item.price)}{licenseLabels[item.licenseType]}
                </p>
              </div>

              {/* Qty */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-7 h-7 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-7 h-7 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Line total */}
              <div className="hidden sm:block text-right flex-shrink-0 w-24">
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{formatPrice(item.price * item.quantity)}</p>
              </div>

              <button onClick={() => removeItem(item.productId)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" aria-label="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <div className="pt-1">
            <Link href="/catalog"><Button variant="ghost" size="sm">← Continue Shopping</Button></Link>
          </div>
        </div>

        {/* Summary */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 sticky top-20 space-y-4">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Delivery / Setup</span>
                <span className="text-emerald-600 font-medium">Included</span>
              </div>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between font-bold text-slate-900 dark:text-slate-100">
              <span>Total</span>
              <span className="text-brand-700 dark:text-brand-400 text-lg">{formatPrice(total)}</span>
            </div>
            <Link href="/checkout"><Button fullWidth size="lg">Proceed to Checkout</Button></Link>
            <p className="text-xs text-slate-400 text-center">Prices exclude VAT where applicable</p>
          </div>
        </div>
      </div>
    </div>
  );
}
