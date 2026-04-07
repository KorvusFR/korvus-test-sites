"use client";

import { useEffect } from "react";
import { gtmViewItem } from "@/lib/gtm";

interface Props {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
}

export function ViewItemTracker({ id, name, category, price, currency }: Props) {
  useEffect(() => {
    gtmViewItem({ id, name, category, price, currency });
  }, [id, name, category, price, currency]);

  return null;
}
