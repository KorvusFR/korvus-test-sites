<template>
  <section class="cart">
    <h1>{{ labels.viewCart }}</h1>
    <p class="path">{{ currentPath }}</p>

    <div v-if="items.length === 0" class="empty">
      <p>Votre panier est vide.</p>
      <NuxtLink :to="categoryPath">{{ labels.navCategory }}</NuxtLink>
    </div>

    <div v-else class="items">
      <ul>
        <li v-for="(item, idx) in items" :key="idx">
          <span class="name">{{ item.name }}</span>
          <span class="qty">×{{ item.quantity }}</span>
          <span class="line-total">{{ (item.price * item.quantity).toFixed(2) }} {{ labels.currency }}</span>
        </li>
      </ul>
      <div class="summary">
        <span>Total</span>
        <strong>{{ total.toFixed(2) }} {{ labels.currency }}</strong>
      </div>
      <NuxtLink :to="routes.checkout" class="cta" data-testid="cart-checkout-link">
        {{ labels.checkoutCta }}
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
const route = useRoute()
const { labels, routes, categoryPath } = useLocale()
const { items, total } = useCart()
const currentPath = computed(() => route.path)
</script>

<style scoped>
.cart h1 { font-size: 24px; margin-bottom: 4px; }
.path { color: #999; font-size: 12px; margin-bottom: 20px; font-family: ui-monospace, monospace; }
.empty { color: #666; }
.empty a { color: #c4385e; }
.items ul { list-style: none; padding: 0; border: 1px solid #eee; border-radius: 6px; }
.items li { display: flex; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #f5f5f5; }
.items li:last-child { border-bottom: none; }
.qty { color: #666; }
.summary { display: flex; justify-content: space-between; padding: 16px; font-size: 18px; }
.cta { display: inline-block; background: #c4385e; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: 600; }
.cta:hover { background: #a82c4d; }
</style>
