"use client";

import Link from "next/link";
import { ShoppingCart, Zap } from "lucide-react";
import { useCart } from "@/context/CartContext";

export function Header() {
  const { itemCount } = useCart();

  return (
    <header className="sticky top-0 z-50 bg-doom-900/95 backdrop-blur-sm border-b border-doom-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-doom-red font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
        >
          <Zap className="w-5 h-5" />
          <span className="font-mono">doomcheck.me</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <Link href="/catalog" className="hover:text-doom-red transition-colors">
            Catalog
          </Link>
          <Link href="/catalog/phones" className="hover:text-doom-red transition-colors">
            Phones
          </Link>
          <Link href="/catalog/audio" className="hover:text-doom-red transition-colors">
            Audio
          </Link>
          <Link href="/catalog/gaming" className="hover:text-doom-red transition-colors">
            Gaming
          </Link>
          <Link href="/catalog/laptops" className="hover:text-doom-red transition-colors">
            Laptops
          </Link>
        </nav>

        <Link
          href="/cart"
          className="relative flex items-center gap-2 text-slate-300 hover:text-doom-red transition-colors"
        >
          <ShoppingCart className="w-5 h-5" />
          {itemCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-doom-red text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {itemCount > 9 ? "9+" : itemCount}
            </span>
          )}
          <span className="hidden sm:inline text-sm">Cart</span>
        </Link>
      </div>
    </header>
  );
}
