import type { Page } from "playwright";
import type { SiteConfig } from "../../config";
import {
  buildUrl,
  scrollPage,
  randomDelay,
  randomItem,
  log,
  safeClick,
  handleShopifyPassword,
} from "../../utils";

const FAKE_NAMES = [
  { first: "Alex", last: "Voss" },
  { first: "Sam", last: "Decker" },
  { first: "Jordan", last: "Holt" },
  { first: "Taylor", last: "Marsh" },
  { first: "Morgan", last: "Blake" },
];

const FAKE_EMAILS = [
  "buyer@example.com",
  "testuser@void.dev",
  "demo@doomcheck.me",
  "shopper@null.io",
];

const FAKE_ADDRESSES = [
  { address: "12 Rue de Rivoli", city: "Paris", zip: "75001" },
  { address: "5 Avenue des Fleurs", city: "Lyon", zip: "69001" },
  { address: "8 Boulevard du Midi", city: "Marseille", zip: "13001" },
  { address: "3 Allée des Roses", city: "Bordeaux", zip: "33000" },
];

/**
 * Shopify purchase: product → add to cart → Shopify checkout (fill name/email/address) → abandon before payment.
 */
export async function runShopifyPurchase(
  page: Page,
  site: SiteConfig,
  utmParams: Record<string, string>,
  dry = false
): Promise<void> {
  const label = `[shopify-purchase][${site.name}]`;

  if (site.productSlugs.length === 0) {
    log(label, "no product slugs configured, skipping");
    return;
  }

  const slug = randomItem(site.productSlugs);
  const productUrl = buildUrl(`${site.baseUrl}/products/${slug}`, utmParams);
  log(label, `navigate → ${productUrl}`);
  if (dry) return;

  // Navigate to home first so the password bypass cookie is set before we go to the product page
  await page.goto(site.baseUrl, { waitUntil: "domcontentloaded" });
  await handleShopifyPassword(page, "rtewng");
  await page.goto(productUrl, { waitUntil: "domcontentloaded" });
  await scrollPage(page);
  await randomDelay(1500, 3000);

  // Select variant if present
  const variantSelects = await page.locator('select[name="id"], .variant-picker select').all();
  for (const sel of variantSelects) {
    const options = await sel.locator("option").all();
    if (options.length > 1) {
      const opt = randomItem(options.slice(1));
      const val = await opt.getAttribute("value");
      if (val) {
        await sel.selectOption(val).catch(() => {});
        await randomDelay(300, 800);
      }
    }
  }

  // Add to cart
  const atcBtn = page
    .locator('button[name="add"], button[type="submit"]')
    .filter({ hasText: /(add to cart|ajouter au panier|add to bag)/i })
    .first();
  const btnVisible = await atcBtn.isVisible().catch(() => false);

  if (!btnVisible) {
    log(label, "add-to-cart button not found — skipping");
    return;
  }

  log(label, "clicking add to cart");
  await safeClick(page, atcBtn);
  await randomDelay(800, 2000);

  // Go to cart
  await page.goto(`${site.baseUrl}/cart`, { waitUntil: "domcontentloaded" });
  await scrollPage(page);
  await randomDelay(800, 1800);

  // Proceed to Shopify checkout
  const checkoutBtn = page
    .locator('a[href*="/checkout"], button')
    .filter({ hasText: /checkout|passer la commande|commander/i })
    .first();
  const checkoutVisible = await checkoutBtn.isVisible().catch(() => false);

  if (checkoutVisible) {
    await safeClick(page, checkoutBtn);
    await page.waitForURL("**/checkouts/**", { timeout: 10000 }).catch(() => {});
  } else {
    await page.goto(`${site.baseUrl}/checkout`, { waitUntil: "domcontentloaded" });
  }

  await scrollPage(page);
  await randomDelay(1000, 2000);

  // Fill Shopify checkout form (information step)
  const name = randomItem(FAKE_NAMES);
  const email = randomItem(FAKE_EMAILS);
  const addr = randomItem(FAKE_ADDRESSES);

  log(label, "filling checkout information");

  async function fill(selector: string, value: string) {
    const el = page.locator(selector).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click().catch(() => {});
      await randomDelay(100, 300);
      await el.fill(value);
      await randomDelay(200, 500);
    }
  }

  // Shopify checkout field selectors
  await fill('input[name="checkout[email]"], input[autocomplete="email"], input[type="email"]', email);
  await fill('input[name="checkout[shipping_address][first_name]"], input[autocomplete="given-name"]', name.first);
  await fill('input[name="checkout[shipping_address][last_name]"], input[autocomplete="family-name"]', name.last);
  await fill('input[name="checkout[shipping_address][address1]"], input[autocomplete="address-line1"]', addr.address);
  await fill('input[name="checkout[shipping_address][city]"], input[autocomplete="address-level2"]', addr.city);
  await fill('input[name="checkout[shipping_address][zip]"], input[autocomplete="postal-code"]', addr.zip);

  await randomDelay(1500, 3000);

  log(label, "abandoning before payment — done");
}
