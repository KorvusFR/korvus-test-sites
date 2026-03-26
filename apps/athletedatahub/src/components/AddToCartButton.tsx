"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/Button";
import type { Product } from "@/types";
import { t, getLocale } from "@/lib/i18n";

interface AddToCartButtonProps {
  product: Product;
  selectedVariant?: string;
  selectedColor?: string;
  size?: "sm" | "md" | "lg";
}

export function AddToCartButton({
  product,
  selectedVariant,
  selectedColor,
  size = "md",
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const locale = getLocale();

  if (!product.inStock) {
    return (
      <Button variant="secondary" size={size} disabled>
        {t("outOfStock")}
      </Button>
    );
  }

  function handleAdd() {
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      nameFr: product.nameFr,
      price: product.price,
      priceFr: product.priceFr,
      image: product.image,
      quantity: 1,
      selectedVariant,
      selectedColor,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <Button
      variant="primary"
      size={size}
      onClick={handleAdd}
      className={added ? "bg-green-600 hover:bg-green-600" : ""}
    >
      {added ? (
        <>
          <Check className="w-4 h-4" />
          {size !== "sm" && (locale === "fr" ? "Ajouté !" : "Added!")}
        </>
      ) : (
        <>
          <ShoppingCart className="w-4 h-4" />
          {size !== "sm" && t("addToCart")}
        </>
      )}
    </Button>
  );
}
