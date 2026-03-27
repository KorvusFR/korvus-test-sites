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

/**
 * Shopify add-to-cart: product page → select variant if present → add to cart → abandon.
 */
export async function runShopifyAddToCart(
  page: Page,
  site: SiteConfig,
  utmParams: Record<string, string>,
  dry = false
): Promise<void> {
  const label = `[shopify-add-to-cart][${site.name}]`;

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

  // Select a variant if variant selects are present
  const variantSelects = await page.locator('select[name="id"], .variant-picker select').all();
  for (const sel of variantSelects) {
    const options = await sel.locator("option").all();
    if (options.length > 1) {
      const opt = randomItem(options.slice(1)); // skip first (disabled placeholder)
      const val = await opt.getAttribute("value");
      if (val) {
        await sel.selectOption(val).catch(() => {});
        await randomDelay(300, 800);
      }
    }
  }

  // Add to cart (Shopify native: button[name="add"])
  const atcBtn = page
    .locator('button[name="add"], button[type="submit"]')
    .filter({ hasText: /(add to cart|ajouter au panier|add to bag)/i })
    .first();
  const btnVisible = await atcBtn.isVisible().catch(() => false);

  if (btnVisible) {
    log(label, "clicking add to cart");
    await safeClick(page, atcBtn);
    await randomDelay(800, 2000);
  } else {
    log(label, "add-to-cart button not found — abandoning");
    return;
  }

  // View cart then abandon
  await page.goto(`${site.baseUrl}/cart`, { waitUntil: "domcontentloaded" });
  await scrollPage(page);
  await randomDelay(1000, 2500);

  log(label, "abandoned cart");
  log(label, "done");
}
