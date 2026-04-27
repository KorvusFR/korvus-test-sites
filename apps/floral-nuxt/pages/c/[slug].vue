<template>
  <section class="plp">
    <h1>{{ data.categoryLabel }}</h1>
    <p class="path">/c/{{ slug }}</p>
    <ul class="products">
      <li class="product-card">
        <a
          :href="productPath"
          data-testid="plp-product-link"
          @click.prevent="goToProduct"
        >
          <h2>{{ data.product.name }}</h2>
          <p class="price">{{ data.product.price.toFixed(2) }} {{ labels.currency }}</p>
        </a>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { data, productPath, labels } = useLocale()

const slug = computed(() => String(route.params.slug ?? ""))

if (slug.value !== data.category) {
  throw createError({
    statusCode: 404,
    statusMessage: `Unknown category for locale: ${slug.value}`,
  })
}

const PDP_JSON_LD_ID = "floral-pdp-jsonld"

function goToProduct(): void {
  // Pre-inject the PDP Product JSON-LD synchronously BEFORE history.pushState
  // so the snippet's page_type cascade sees `pdp` on the SPA pageview emit.
  // Without this, the snippet detects `other` and skips ATC collector init
  // (cf. snippet/src/collectors/add-to-cart-attempt.ts:30 — `if getPageType()
  // !== "pdp" return`). In a real Nuxt SSR app, this is what Nuxt's
  // asyncData/useFetch would effectively achieve before route swap.
  if (typeof document !== "undefined" && !document.getElementById(PDP_JSON_LD_ID)) {
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
    const node = document.createElement("script")
    node.id = PDP_JSON_LD_ID
    node.type = "application/ld+json"
    node.textContent = jsonLd
    document.head.appendChild(node)
  }
  router.push(productPath)
}
</script>

<style scoped>
.plp h1 { font-size: 24px; margin-bottom: 4px; }
.path { color: #999; font-size: 13px; margin-bottom: 24px; font-family: ui-monospace, monospace; }
.products { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.product-card { border: 1px solid #ddd; border-radius: 8px; }
.product-card a { display: block; padding: 16px; text-decoration: none; color: inherit; }
.product-card h2 { font-size: 16px; margin: 0 0 8px; color: #333; }
.price { color: #c4385e; font-weight: 600; margin: 0; }
.product-card:hover { border-color: #c4385e; }
</style>
