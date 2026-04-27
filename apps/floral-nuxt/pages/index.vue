<template>
  <section class="home">
    <h1>{{ data.siteName }}</h1>
    <p class="tagline">Bouquets et compositions florales — livraison express.</p>
    <div class="categories">
      <NuxtLink :to="categoryPath" class="category-tile" data-testid="home-category-link">
        <h2>{{ data.categoryLabel }}</h2>
        <p>Découvrir notre sélection</p>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
const { data, categoryPath } = useLocale()
</script>

<style scoped>
.home h1 { font-size: 28px; margin-bottom: 8px; }
.tagline { color: #666; margin-bottom: 32px; }
.categories { display: flex; gap: 16px; }
.category-tile { display: block; padding: 24px; border: 1px solid #ddd; border-radius: 8px; text-decoration: none; color: inherit; min-width: 240px; }
.category-tile h2 { margin: 0 0 6px; font-size: 18px; color: #c4385e; }
.category-tile p { margin: 0; color: #666; font-size: 14px; }
.category-tile:hover { border-color: #c4385e; }
</style>
