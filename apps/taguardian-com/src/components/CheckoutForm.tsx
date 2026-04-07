"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, CreditCard } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { formatPrice } from "@/lib/utils";
import { gtmBeginCheckout, gtmPurchase, pushDataLayer } from "@/lib/gtm";

const ORDER_KEY = "taguardian_last_order";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  vatNumber: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
}

const EMPTY: FormData = {
  firstName: "", lastName: "", email: "", company: "", phone: "",
  address: "", city: "", postalCode: "", country: "", vatNumber: "",
  cardNumber: "", expiryDate: "", cvv: "",
};

export function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chaosMode = searchParams.get("chaos");
  const { items, total, clearCart } = useCart();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutFired, setCheckoutFired] = useState(false);

  // Fire begin_checkout once on first render with items
  if (items.length > 0 && !checkoutFired) {
    setCheckoutFired(true);
    gtmBeginCheckout(
      items.map((i) => ({
        id: i.productId,
        name: i.name,
        category: "unknown",
        price: i.price,
        quantity: i.quantity,
      })),
      total
    );
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const orderNumber = `TGD-${Date.now().toString(36).toUpperCase()}`;
    const orderItems = items.map((i) => ({
      id: i.productId,
      name: i.name,
      category: "unknown",
      price: i.price,
      quantity: i.quantity,
    }));

    // Persist order for confirmation page to fire purchase event
    try {
      localStorage.setItem(
        ORDER_KEY,
        JSON.stringify({ orderNumber, items: orderItems, total, shipping: 0 })
      );
    } catch { /* ignore */ }

    // GTM purchase event
    if (chaosMode === "broken_purchase") {
      // Intentionally malformed: missing value and transaction_id
      pushDataLayer("purchase", {
        ecommerce: {
          currency: "EUR",
          items: orderItems.map((i) => ({
            item_id: i.id,
            item_name: i.name,
            item_category: i.category,
            price: i.price,
            quantity: i.quantity,
          })),
        },
      });
    } else {
      gtmPurchase({ orderNumber, items: orderItems, total, shipping: 0 });
    }

    setTimeout(() => {
      clearCart();
      router.push(`/checkout/confirmation?order=${orderNumber}`);
    }, 1000);
  }

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-slate-600 dark:text-slate-400 mb-4">Your cart is empty.</p>
        <Link href="/catalog"><Button>Browse Solutions</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]} />
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Checkout</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-5">
          {/* Company & Contact */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Company & Contact</h2>
            <Input id="company" name="company" label="Company Name" value={form.company} onChange={handleChange} required placeholder="Acme Corp" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input id="firstName" name="firstName" label="First Name" value={form.firstName} onChange={handleChange} required autoComplete="given-name" />
              <Input id="lastName" name="lastName" label="Last Name" value={form.lastName} onChange={handleChange} required autoComplete="family-name" />
            </div>
            <Input id="email" name="email" type="email" label="Business Email" value={form.email} onChange={handleChange} required autoComplete="email" />
            <Input id="phone" name="phone" type="tel" label="Phone" value={form.phone} onChange={handleChange} autoComplete="tel" />
          </section>

          {/* Billing Address */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Billing Address</h2>
            <Input id="address" name="address" label="Street Address" value={form.address} onChange={handleChange} required autoComplete="street-address" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input id="city" name="city" label="City" value={form.city} onChange={handleChange} required autoComplete="address-level2" />
              <Input id="postalCode" name="postalCode" label="Postal Code" value={form.postalCode} onChange={handleChange} required autoComplete="postal-code" />
              <Input id="country" name="country" label="Country" value={form.country} onChange={handleChange} required autoComplete="country-name" />
            </div>
            <Input id="vatNumber" name="vatNumber" label="VAT Number (optional)" value={form.vatNumber} onChange={handleChange} placeholder="FR12345678901" />
          </section>

          {/* Payment */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 dark:text-slate-100">Payment</h2>
              <Lock className="w-4 h-4 text-slate-400" />
            </div>
            <Input id="cardNumber" name="cardNumber" label="Card Number" value={form.cardNumber} onChange={handleChange} required placeholder="4242 4242 4242 4242" maxLength={19} autoComplete="cc-number" />
            <div className="grid grid-cols-2 gap-4">
              <Input id="expiryDate" name="expiryDate" label="Expiry Date" value={form.expiryDate} onChange={handleChange} required placeholder="MM/YY" maxLength={5} autoComplete="cc-exp" />
              <Input id="cvv" name="cvv" label="CVV" value={form.cvv} onChange={handleChange} required placeholder="123" maxLength={4} autoComplete="cc-csc" />
            </div>
            <div className="flex items-center gap-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg px-3 py-2">
              <CreditCard className="w-4 h-4 text-brand-500 flex-shrink-0" />
              <p className="text-xs text-brand-700 dark:text-brand-300">
                Simulated payment — no real card data is processed.
              </p>
            </div>
          </section>

          <Button type="submit" size="lg" fullWidth disabled={submitting}>
            {submitting ? "Processing…" : "Place Order"}
          </Button>
        </form>

        {/* Summary */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 sticky top-20">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-4">Order Summary</h2>
            <ul className="space-y-3 mb-4">
              {items.map((item) => (
                <li key={item.productId} className="flex items-start justify-between gap-2 text-sm">
                  <span className="text-slate-700 dark:text-slate-300 line-clamp-2 flex-1">
                    {item.name}
                    <span className="text-slate-400 ml-1">×{item.quantity}</span>
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 flex-shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal</span><span>{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Delivery</span><span className="text-emerald-600 font-medium">Included</span>
              </div>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 mt-3 pt-3 flex justify-between font-bold text-slate-900 dark:text-slate-100">
              <span>Total</span>
              <span className="text-brand-700 dark:text-brand-400 text-lg">{formatPrice(total)}</span>
            </div>
            <p className="text-xs text-slate-400 text-center mt-3">Prices exclude VAT</p>
          </div>
        </div>
      </div>
    </div>
  );
}
