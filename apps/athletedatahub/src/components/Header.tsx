"use client";

import Link from "next/link";
import { ShoppingCart, Menu, X, Dumbbell } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { t } from "@/lib/i18n";

export function Header() {
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: t("home") },
    { href: "/catalog", label: t("catalog") },
    { href: "/catalog/clothing", label: t("clothing") },
    { href: "/catalog/equipment", label: t("equipment") },
    { href: "/catalog/nutrition", label: t("nutrition") },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-xl text-blue-700 hover:text-blue-800 transition-colors"
          >
            <Dumbbell className="w-6 h-6" />
            <span>AthleteDataHub</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-medium text-gray-600 hover:text-blue-700 transition-colors"
            >
              {t("home")}
            </Link>
            <Link
              href="/catalog"
              className="text-sm font-medium text-gray-600 hover:text-blue-700 transition-colors"
            >
              {t("catalog")}
            </Link>
            <Link
              href="/catalog/clothing"
              className="text-sm font-medium text-gray-600 hover:text-blue-700 transition-colors"
            >
              {t("clothing")}
            </Link>
            <Link
              href="/catalog/equipment"
              className="text-sm font-medium text-gray-600 hover:text-blue-700 transition-colors"
            >
              {t("equipment")}
            </Link>
            <Link
              href="/catalog/nutrition"
              className="text-sm font-medium text-gray-600 hover:text-blue-700 transition-colors"
            >
              {t("nutrition")}
            </Link>
          </nav>

          {/* Cart + Mobile menu */}
          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              className="relative flex items-center gap-1 p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
              aria-label={t("cart")}
            >
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
              <span className="hidden sm:inline text-sm font-medium">
                {t("cart")}
              </span>
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="py-2 px-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-blue-700 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
