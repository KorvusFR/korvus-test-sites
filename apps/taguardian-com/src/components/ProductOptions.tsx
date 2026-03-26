"use client";

import { useState } from "react";
import type { Product } from "@/types";
import { AddToCartButton } from "@/components/AddToCartButton";

export function ProductOptions({ product }: { product: Product }) {
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>(
    product.variants[0]
  );

  return (
    <div className="flex flex-col gap-4">
      {product.variants.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            License / Plan
          </p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <button
                key={v}
                onClick={() => setSelectedVariant(v)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  selectedVariant === v
                    ? "border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-400"
                    : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-2">
        <AddToCartButton
          product={product}
          selectedVariant={selectedVariant}
          size="lg"
        />
      </div>
    </div>
  );
}
