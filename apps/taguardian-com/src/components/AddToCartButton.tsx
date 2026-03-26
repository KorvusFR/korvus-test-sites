"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/Button";
import type { Product } from "@/types";
import { gtmAddToCart } from "@/lib/gtm";

interface AddToCartButtonProps {
  product: Product;
  selectedVariant?: string;
  size?: "sm" | "md" | "lg";
}

export function AddToCartButton({
  product,
  selectedVariant,
  size = "md",
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  if (!product.inStock) {
    return (
      <Button variant="secondary" size={size} disabled>
        Out of Stock
      </Button>
    );
  }

  function handleAdd() {
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      quantity: 1,
      selectedVariant,
      licenseType: product.licenseType,
    });

    // GTM event
    gtmAddToCart({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      quantity: 1,
      variant: selectedVariant,
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <Button
      variant="primary"
      size={size}
      onClick={handleAdd}
      className={added ? "!bg-emerald-600 !hover:bg-emerald-600" : ""}
    >
      {added ? (
        <>
          <Check className="w-4 h-4" />
          {size !== "sm" && "Added!"}
        </>
      ) : (
        <>
          <ShoppingCart className="w-4 h-4" />
          {size !== "sm" && "Add to Cart"}
        </>
      )}
    </Button>
  );
}
