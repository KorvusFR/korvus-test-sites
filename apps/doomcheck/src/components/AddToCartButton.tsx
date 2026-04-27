"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/Button";
import type { Product } from "@/types";
import { gtmAddToCart } from "@/lib/gtm";
import { hasFlag } from "@/lib/chaos";

interface Props {
  product: Product;
  selectedVariant?: string;
  selectedColor?: string;
}

export function AddToCartButton({ product, selectedVariant, selectedColor }: Props) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    if (hasFlag("atc_silent_fail")) {
      // Chaos: button appears to work but does nothing
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
      return;
    }

    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      quantity: 1,
      selectedVariant,
      selectedColor,
    });
    gtmAddToCart({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      quantity: 1,
      variant: selectedVariant,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  if (!product.inStock) {
    return (
      <Button variant="secondary" disabled size="lg" className="w-full">
        Out of Stock
      </Button>
    );
  }

  return (
    <Button
      variant={added ? "secondary" : "primary"}
      size="lg"
      className="w-full gap-2"
      onClick={handleAdd}
      data-add-to-cart
    >
      {added ? (
        <>
          <Check className="w-4 h-4" />
          Added to Cart
        </>
      ) : (
        <>
          <ShoppingCart className="w-4 h-4" />
          Add to Cart
        </>
      )}
    </Button>
  );
}
