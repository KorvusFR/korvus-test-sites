"use client";

import { useEffect } from "react";
import { gtmViewItem } from "@/lib/gtm";

interface Props {
  id: string;
  name: string;
  category: string;
  price: number;
}

export function ViewItemTracker({ id, name, category, price }: Props) {
  useEffect(() => {
    gtmViewItem({ id, name, category, price });
  }, [id, name, category, price]);

  return null;
}
