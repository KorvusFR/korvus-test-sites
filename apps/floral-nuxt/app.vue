<template>
  <div class="site">
    <header class="site-header">
      <NuxtLink to="/" class="brand">{{ data.siteName }}</NuxtLink>
      <nav class="site-nav">
        <NuxtLink to="/">{{ labels.navHome }}</NuxtLink>
        <NuxtLink :to="categoryPath">{{ labels.navCategory }}</NuxtLink>
        <NuxtLink :to="routes.cart" class="cart-link" data-testid="header-cart-link">
          {{ labels.viewCart }} ({{ count }})
        </NuxtLink>
      </nav>
    </header>
    <main class="site-main">
      <NuxtPage />
    </main>
    <footer class="site-footer">
      <span>locale: {{ locale }}</span> · <span>website: {{ data.siteName }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
const { locale, data, labels, routes, categoryPath } = useLocale()
const { count } = useCart()
</script>

<style>
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; color: #222; }
.site { display: flex; flex-direction: column; min-height: 100vh; }
.site-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid #eee; }
.brand { font-weight: 600; text-decoration: none; color: #222; }
.site-nav a { margin-left: 16px; color: #444; text-decoration: none; }
.site-nav a.router-link-active { color: #c4385e; font-weight: 600; }
.site-main { flex: 1; padding: 24px; max-width: 960px; margin: 0 auto; width: 100%; }
.site-footer { padding: 12px 24px; border-top: 1px solid #eee; font-size: 12px; color: #888; text-align: center; }
button { cursor: pointer; }
</style>
