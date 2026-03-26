"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { Input } from "@/components/ui/Input";
import { formatPrice } from "@/lib/utils";

const CHAOS_FLAGS = (process.env.NEXT_PUBLIC_CHAOS_FLAGS ?? "")
  .split(",")
  .map((f) => f.trim());

function generateOrderNumber(): string {
  return "DC-" + Math.floor(100000 + Math.random() * 900000).toString();
}

export function CheckoutForm() {
  const router = useRouter();
  const { items, total, clearCart, itemCount } = useCart();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    zip: "",
    country: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (CHAOS_FLAGS.includes("checkout_crash")) {
      throw new Error(
        "[doomcheck chaos] checkout_crash: simulated checkout form crash"
      );
    }

    setSubmitting(true);
    const orderNumber = generateOrderNumber();

    setTimeout(() => {
      clearCart();
      router.push(`/checkout/confirmation?order=${orderNumber}&total=${total}`);
    }, 1200);
  }

  if (itemCount === 0) {
    return (
      <div className="text-center py-12 text-doom-400">
        <p>Your cart is empty. Nothing to check out.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <section className="bg-doom-800 border border-doom-700 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Contact
          </h2>
          <Input
            id="email"
            name="email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
            required
          />
        </section>

        <section className="bg-doom-800 border border-doom-700 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Shipping
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="firstName"
              name="firstName"
              label="First name"
              placeholder="John"
              value={form.firstName}
              onChange={handleChange}
              required
            />
            <Input
              id="lastName"
              name="lastName"
              label="Last name"
              placeholder="Doom"
              value={form.lastName}
              onChange={handleChange}
              required
            />
          </div>
          <Input
            id="address"
            name="address"
            label="Address"
            placeholder="1 Void Street"
            value={form.address}
            onChange={handleChange}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="city"
              name="city"
              label="City"
              placeholder="Doomhaven"
              value={form.city}
              onChange={handleChange}
              required
            />
            <Input
              id="zip"
              name="zip"
              label="ZIP / Postal code"
              placeholder="00000"
              value={form.zip}
              onChange={handleChange}
              required
            />
          </div>
          <Input
            id="country"
            name="country"
            label="Country"
            placeholder="FR"
            value={form.country}
            onChange={handleChange}
            required
          />
        </section>

        <section className="bg-doom-800 border border-doom-700 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Payment
          </h2>
          <div className="flex items-center gap-2 text-xs text-doom-400 mb-2">
            <span className="bg-doom-700 px-2 py-1 rounded font-mono">
              SIMULATED — no real charge
            </span>
          </div>
          <Input
            id="cardNumber"
            name="cardNumber"
            label="Card number"
            placeholder="4242 4242 4242 4242"
            maxLength={19}
            value={form.cardNumber}
            onChange={handleChange}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="cardExpiry"
              name="cardExpiry"
              label="Expiry"
              placeholder="MM/YY"
              maxLength={5}
              value={form.cardExpiry}
              onChange={handleChange}
              required
            />
            <Input
              id="cardCvc"
              name="cardCvc"
              label="CVC"
              placeholder="123"
              maxLength={4}
              value={form.cardCvc}
              onChange={handleChange}
              required
            />
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <div className="bg-doom-800 border border-doom-700 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Order summary
          </h2>
          <div className="space-y-3 text-sm">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between gap-2">
                <span className="text-doom-400 line-clamp-1 flex-1">
                  {item.name}{" "}
                  <span className="text-doom-500">×{item.quantity}</span>
                </span>
                <span className="text-slate-300 shrink-0">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-doom-700 mt-4 pt-4 flex justify-between font-bold text-slate-200">
            <span>Total</span>
            <span className="text-doom-red">{formatPrice(total)}</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-doom-red text-white font-bold text-base py-3 rounded-md hover:bg-red-600 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Processing…" : `Pay ${formatPrice(total)}`}
        </button>

        {CHAOS_FLAGS.includes("checkout_crash") && (
          <p className="text-xs text-doom-green font-mono text-center">
            ⚡ chaos: checkout_crash active
          </p>
        )}
      </aside>
    </form>
  );
}
