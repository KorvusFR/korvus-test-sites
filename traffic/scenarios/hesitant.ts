import type { Page } from "playwright";
import type { SiteConfig } from "../config";
import { randomDelay, randomItem, buildUrl, scrollPage, log, safeClick } from "../utils";

/**
 * Hesitant scenario: Adds to cart, goes to cart, removes the item, and leaves.
 */
export async function runHesitant(
  page: Page,
  site: SiteConfig,
  utmParams: Record<string, string>,
  dry = false
): Promise<void> {
  const label = `[hesitant][${site.name}]`;

  const slug = randomItem(site.productSlugs.length > 0 ? site.productSlugs : [""]);
  const productUrl = buildUrl(`${site.baseUrl}/products/${slug}`, utmParams);

  log(label, `navigate → ${productUrl}`);
  if (dry) return;

  await page.goto(productUrl, { waitUntil: "domcontentloaded" });
  await scrollPage(page);
  await randomDelay(1500, 3000);

  // Add to cart
  const atcBtn = page
    .locator("button")
    .filter({ hasText: /(add to cart|ajouter au panier)/i })
    .first();
  const btnVisible = await atcBtn.isVisible().catch(() => false);

  if (btnVisible) {
    log(label, "clicking add to cart");
    await safeClick(page, atcBtn);
    await randomDelay(1000, 2000);
  } else {
    log(label, "add-to-cart not found, skipping");
    return;
  }

  // Go to cart
  log(label, "navigate → cart");
  await page.goto(`${site.baseUrl}/cart`, { waitUntil: "domcontentloaded" });
  await scrollPage(page);
  await randomDelay(1500, 3500);

  // Remove from cart
  const removeBtnLabel = page.locator('button[aria-label="Remove"], button[aria-label="Supprimer"], button:has(svg.lucide-trash-2)').first();
  const removeVisible = await removeBtnLabel.isVisible().catch(() => false);

  if (removeVisible) {
    log(label, "removing item from cart");
    await safeClick(page, removeBtnLabel);
    await randomDelay(1000, 2500);
  }

  log(label, "hesitant — leaving without purchase");
}
