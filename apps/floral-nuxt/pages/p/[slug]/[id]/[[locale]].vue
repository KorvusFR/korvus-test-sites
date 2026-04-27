<template>
  <section class="pdp">
    <nav class="breadcrumb">
      <NuxtLink to="/">{{ labels.navHome }}</NuxtLink>
      <span> / </span>
      <NuxtLink :to="categoryPath">{{ data.categoryLabel }}</NuxtLink>
    </nav>
    <h1>{{ data.product.name }}</h1>
    <p class="price">{{ data.product.price.toFixed(2) }} {{ labels.currency }}</p>
    <p class="path">{{ currentPath }}</p>
    <button
      type="button"
      class="add-to-cart"
      id="atc-btn"
      data-testid="pdp-atc-button"
      @click="onAddToCart"
    >
      {{ labels.addToCart }}
    </button>
  </section>
</template>

<script setup lang="ts">
const route = useRoute()
const { data, labels, categoryPath } = useLocale()
const { addItem } = useCart()

const slug = computed(() => String(route.params.slug ?? ""))
const id = computed(() => String(route.params.id ?? ""))

if (
  slug.value !== data.product.slug ||
  id.value !== data.product.id
) {
  throw createError({
    statusCode: 404,
    statusMessage: `Unknown product for locale: /${slug.value}/${id.value}`,
  })
}

const currentPath = computed(() => route.path)

const jsonLd = JSON.stringify({
  "@context": "https://schema.org/",
  "@type": "Product",
  name: data.product.name,
  sku: data.product.id,
  description: `${data.product.name} — ${data.categoryLabel}`,
  offers: {
    "@type": "Offer",
    price: data.product.price.toFixed(2),
    priceCurrency: data.currency,
    availability: "https://schema.org/InStock",
  },
})

// Inject + remove JSON-LD via direct DOM manipulation rather than useHead.
// useHead's reactive cleanup is async and races with the snippet's page_type
// cascade on SPA navigation away from the PDP — the cart pageview ends up
// detected as `pdp` because residual JSON-LD wins over URL pattern.
// onBeforeUnmount runs synchronously when router.push leaves the PDP.
const JSON_LD_ID = "floral-pdp-jsonld"

if (import.meta.server) {
  useHead({
    script: [
      {
        id: JSON_LD_ID,
        type: "application/ld+json",
        innerHTML: jsonLd,
      },
    ],
  })
}

if (import.meta.client) {
  // Inject JSON-LD synchronously during setup so it's in DOM BEFORE the
  // snippet emits the PDP pageview on SPA navigation. The snippet's ATC
  // collector only inits when bus.getPageType() === "pdp", which depends
  // on JSON-LD Product schema being present at pageview emit time.
  if (typeof document !== "undefined" && !document.getElementById(JSON_LD_ID)) {
    const node = document.createElement("script")
    node.id = JSON_LD_ID
    node.type = "application/ld+json"
    node.textContent = jsonLd
    document.head.appendChild(node)
  }
  onBeforeUnmount(() => {
    document.getElementById(JSON_LD_ID)?.remove()
  })
}

function onAddToCart(): void {
  // useCart.addItem mutates the cart array AND writes to localStorage.
  // The badge in the header reactively updates (cascade `badge_count`
  // possible) and the localStorage write triggers the snippet's
  // monkey-patched Storage.setItem (cascade `localstorage_cart`).
  // The PDP does NOT auto-navigate to cart so the snippet's
  // add_to_cart_attempt PerformanceObserver fallback (2s timeout) has time
  // to emit before any SPA cleanup tears down the collector.
  addItem({
    productId: data.product.id,
    name: data.product.name,
    price: data.product.price,
    quantity: 1,
  })
}
</script>

<style scoped>
.pdp { max-width: 640px; }
.breadcrumb { font-size: 13px; color: #888; margin-bottom: 16px; }
.breadcrumb a { color: #888; text-decoration: none; }
.breadcrumb a:hover { color: #c4385e; }
h1 { font-size: 28px; margin: 0 0 8px; }
.price { font-size: 20px; color: #c4385e; font-weight: 600; margin: 0 0 4px; }
.path { color: #999; font-size: 12px; margin-bottom: 24px; font-family: ui-monospace, monospace; }
.add-to-cart {
  background: #c4385e;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 600;
}
.add-to-cart:hover { background: #a82c4d; }
</style>
