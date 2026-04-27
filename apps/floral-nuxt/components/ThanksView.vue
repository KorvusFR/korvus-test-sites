<template>
  <section class="thanks">
    <h1>{{ labels.thanksTitle }}</h1>
    <p class="subtitle">{{ labels.thanksSubtitle }}</p>
    <p class="path">{{ currentPath }}</p>
    <p class="order">Commande #{{ transactionId }} — {{ orderTotal.toFixed(2) }} {{ labels.currency }}</p>
    <NuxtLink to="/" class="cta">{{ labels.navHome }}</NuxtLink>
  </section>
</template>

<script setup lang="ts">
const route = useRoute()
const { data, labels } = useLocale()
const { items, total, clear } = useCart()

const currentPath = computed(() => route.path)

const fallbackItem = {
  productId: data.product.id,
  name: data.product.name,
  price: data.product.price,
  quantity: 1,
}

const snapshot = items.value.length > 0 ? items.value : [fallbackItem]
const orderTotal = items.value.length > 0 ? total.value : data.product.price
const transactionId = `FLO-${data.product.id}-${Date.now().toString(36).toUpperCase()}`

onMounted(() => {
  if (typeof window === "undefined") return
  if (!Array.isArray(window.dataLayer)) window.dataLayer = []
  // Push purchase à l'arrivée sur la page de remerciement — convention GA4
  // ecommerce. NOTE : sur SPA Vue/Nuxt, le snippet peut ne pas avoir
  // monkey-patché dataLayer.push à cet instant (race lifecycle plugin/Vue
  // hydration vs window.load). Les tests E2E poussent le purchase via
  // addInitScript pour que la replay du snippet le capture deterministiquement.
  window.dataLayer.push({
    event: "purchase",
    ecommerce: {
      transaction_id: transactionId,
      value: orderTotal,
      currency: data.currency,
      items: snapshot.map((item) => ({
        item_id: item.productId,
        item_name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    },
  })
  clear()
})
</script>

<style scoped>
.thanks h1 { font-size: 28px; color: #2d6a4f; margin-bottom: 8px; }
.subtitle { color: #555; margin-bottom: 16px; }
.path { color: #999; font-size: 12px; margin-bottom: 12px; font-family: ui-monospace, monospace; }
.order { padding: 16px; background: #f3f8f4; border: 1px solid #d0e0d4; border-radius: 6px; margin-bottom: 24px; }
.cta { display: inline-block; background: #c4385e; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: 600; }
.cta:hover { background: #a82c4d; }
</style>
