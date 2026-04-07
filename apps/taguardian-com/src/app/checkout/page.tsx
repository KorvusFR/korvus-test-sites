import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/CheckoutForm";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutForm />
    </Suspense>
  );
}
