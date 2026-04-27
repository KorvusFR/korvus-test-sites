export interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

const CART_STORAGE_KEY = "floral_cart"

export function useCart() {
  const items = useState<CartItem[]>("floral-cart", () => [])

  function addItem(item: CartItem): void {
    items.value = [...items.value, item]
    if (import.meta.client) {
      try {
        localStorage.setItem(
          CART_STORAGE_KEY,
          JSON.stringify({ items: items.value }),
        )
      } catch {
        // sessionStorage blocked, no-op
      }
    }
  }

  function clear(): void {
    items.value = []
    if (import.meta.client) {
      try {
        localStorage.removeItem(CART_STORAGE_KEY)
      } catch {
        // no-op
      }
    }
  }

  const total = computed(() =>
    items.value.reduce((sum, item) => sum + item.price * item.quantity, 0),
  )

  const count = computed(() =>
    items.value.reduce((sum, item) => sum + item.quantity, 0),
  )

  return { items, total, count, addItem, clear }
}
