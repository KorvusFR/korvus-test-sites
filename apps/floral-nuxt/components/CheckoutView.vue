<template>
  <section class="checkout">
    <h1>{{ labels.checkoutCta }}</h1>
    <p class="path">{{ currentPath }}</p>

    <div class="summary">
      <strong>Total :</strong>
      <span>{{ total.toFixed(2) }} {{ labels.currency }}</span>
    </div>

    <fieldset id="payment-options" class="payment-options">
      <legend>Mode de paiement</legend>
      <label v-for="method in methods" :key="method.value" class="method">
        <input
          type="radio"
          name="payment_method"
          :value="method.value"
          v-model="selectedMethod"
        />
        <span>{{ method.label }}</span>
      </label>
    </fieldset>

    <button
      type="button"
      class="pay-btn"
      data-testid="pay-button"
      :disabled="!selectedMethod"
      @click="onPay"
    >
      {{ labels.pay }}
    </button>
  </section>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { labels, routes } = useLocale()
const { total } = useCart()

const currentPath = computed(() => route.path)

const methods = [
  { value: "card", label: "Carte bancaire" },
  { value: "paypal", label: "PayPal" },
]

const selectedMethod = ref<string>("")

function onPay(): void {
  // Defer SPA nav so payment_attempted (delegated click listener) and
  // payment_method_selected captures complete before SPA cleanup runs.
  setTimeout(() => router.push(routes.thanks), 50)
}
</script>

<style scoped>
.checkout h1 { font-size: 24px; margin-bottom: 4px; }
.path { color: #999; font-size: 12px; margin-bottom: 20px; font-family: ui-monospace, monospace; }
.summary { padding: 16px; background: #f9f5f0; border-radius: 6px; margin-bottom: 24px; display: flex; gap: 8px; }
.payment-options { border: 1px solid #ddd; border-radius: 6px; padding: 16px; margin-bottom: 24px; }
.payment-options legend { font-weight: 600; padding: 0 8px; }
.method { display: flex; align-items: center; gap: 8px; padding: 8px 0; cursor: pointer; }
.pay-btn {
  background: #c4385e;
  color: white;
  border: none;
  padding: 14px 32px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 600;
}
.pay-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pay-btn:not(:disabled):hover { background: #a82c4d; }
</style>
