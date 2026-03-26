"use client";

import Link from "next/link";
import { Trash2, Plus, Minus } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/utils";

export function CartView() {
  const { items, total, removeItem, updateQuantity, itemCount } = useCart();

  if (itemCount === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-6xl mb-4">🛒</p>
        <h2 className="text-xl font-semibold text-slate-300 mb-2">
          Your cart is empty
        </h2>
        <p className="text-doom-400 mb-6">The void awaits your selections.</p>
        <Link
          href="/catalog"
          className="inline-flex items-center justify-center bg-doom-red text-white font-semibold text-base px-6 py-3 rounded-md hover:bg-red-600 transition-colors"
        >
          Browse Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-doom-800 border border-doom-700 rounded-lg divide-y divide-doom-700">
        {items.map((item) => (
          <div key={item.productId} className="p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <Link
                href={`/products/${item.slug}`}
                className="text-sm font-semibold text-slate-200 hover:text-doom-red transition-colors line-clamp-1"
              >
                {item.name}
              </Link>
              {item.selectedVariant && (
                <p className="text-xs text-doom-400 mt-0.5">
                  {item.selectedVariant}
                  {item.selectedColor ? ` · ${item.selectedColor}` : ""}
                </p>
              )}
              <p className="text-doom-red font-semibold text-sm mt-1">
                {formatPrice(item.price)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  updateQuantity(item.productId, item.quantity - 1)
                }
                className="w-7 h-7 rounded bg-doom-700 hover:bg-doom-600 flex items-center justify-center text-slate-300 transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-8 text-center text-sm font-medium text-slate-200">
                {item.quantity}
              </span>
              <button
                onClick={() =>
                  updateQuantity(item.productId, item.quantity + 1)
                }
                className="w-7 h-7 rounded bg-doom-700 hover:bg-doom-600 flex items-center justify-center text-slate-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="text-right min-w-[70px]">
              <p className="text-sm font-semibold text-slate-200">
                {formatPrice(item.price * item.quantity)}
              </p>
            </div>

            <button
              onClick={() => removeItem(item.productId)}
              className="text-doom-400 hover:text-doom-red transition-colors p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-doom-800 border border-doom-700 rounded-lg p-4">
        <div className="flex items-center justify-between text-lg font-bold text-slate-200 mb-4">
          <span>Total</span>
          <span className="text-doom-red">{formatPrice(total)}</span>
        </div>
        <Link
          href="/checkout"
          className="block w-full text-center bg-doom-red text-white font-semibold text-base px-6 py-3 rounded-md hover:bg-red-600 transition-colors"
        >
          Proceed to Checkout
        </Link>
      </div>
    </div>
  );
}
