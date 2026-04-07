/**
 * dataLayer utilities
 *
 * All push calls are safe to invoke server-side (they no-op) and
 * automatically coerce to the GA4 standard event schema.
 */

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

/** Push any event to the dataLayer. No-ops when called server-side. */
export function pushDataLayer(
  event: string,
  data?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...data });

  if (process.env.NODE_ENV === "development") {
    console.debug("[GTM]", event, data ?? {});
  }
}

// ─── Typed event helpers ──────────────────────────────────────────────────────

export function gtmPageView(pagePath: string, pageTitle?: string): void {
  pushDataLayer("page_view", {
    page_path: pagePath,
    page_title: pageTitle,
  });
}

export function gtmViewItem(item: {
  id: string;
  name: string;
  category: string;
  price: number;
}): void {
  pushDataLayer("view_item", {
    ecommerce: {
      currency: "EUR",
      value: item.price,
      items: [
        {
          item_id: item.id,
          item_name: item.name,
          item_category: item.category,
          price: item.price,
        },
      ],
    },
  });
}

export function gtmAddToCart(item: {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  variant?: string;
}): void {
  pushDataLayer("add_to_cart", {
    ecommerce: {
      currency: "EUR",
      value: item.price * item.quantity,
      items: [
        {
          item_id: item.id,
          item_name: item.name,
          item_category: item.category,
          price: item.price,
          quantity: item.quantity,
          item_variant: item.variant,
        },
      ],
    },
  });
}

export function gtmPurchase(order: {
  orderNumber: string;
  items: {
    id: string;
    name: string;
    category: string;
    price: number;
    quantity: number;
  }[];
  total: number;
}): void {
  pushDataLayer("purchase", {
    ecommerce: {
      currency: "EUR",
      transaction_id: order.orderNumber,
      value: order.total,
      items: order.items.map((i) => ({
        item_id: i.id,
        item_name: i.name,
        item_category: i.category,
        price: i.price,
        quantity: i.quantity,
      })),
    },
  });
}
