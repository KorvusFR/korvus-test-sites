"use client";

import { useEffect, useState } from "react";
import type { Category } from "@/types";

const CHAOS_FLAGS = (process.env.NEXT_PUBLIC_CHAOS_FLAGS ?? "")
  .split(",")
  .map((f) => f.trim());

const CATEGORY_ICONS: Record<Category, string> = {
  phones: "📱",
  audio: "🎧",
  gaming: "🎮",
  laptops: "💻",
  accessories: "🔌",
};

const CATEGORY_BG: Record<Category, string> = {
  phones: "bg-indigo-900/40",
  audio: "bg-purple-900/40",
  gaming: "bg-red-900/40",
  laptops: "bg-doom-700",
  accessories: "bg-teal-900/40",
};

interface Props {
  category: Category;
  name: string;
  className?: string;
}

export function ProductImage({ category, name, className = "" }: Props) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (CHAOS_FLAGS.includes("broken_images") && Math.random() < 0.3) {
      setBroken(true);
    }
  }, []);

  const bg = CATEGORY_BG[category] ?? "bg-doom-700";
  const icon = CATEGORY_ICONS[category] ?? "📦";

  if (broken) {
    return (
      <div className={`${className} ${bg} flex items-center justify-center overflow-hidden`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/product-nonexistent-404.jpg"
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${className} ${bg} flex items-center justify-center border border-doom-700`}
    >
      <span className="text-5xl select-none" role="img" aria-label={name}>
        {icon}
      </span>
    </div>
  );
}
