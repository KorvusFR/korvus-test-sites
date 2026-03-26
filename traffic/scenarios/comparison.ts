import type { Page } from "playwright";
import type { SiteConfig } from "../config";
import { randomDelay, randomItem, buildUrl, scrollPage, log } from "../utils";

/**
 * Comparison scenario: visits 4-5 product pages, long scrolls, doesn't add to cart.
 */
export async function runComparison(
  page: Page,
  site: SiteConfig,
  utmParams: Record<string, string>,
  dry = false
): Promise<void> {
  const label = `[comparison][${site.name}]`;

  if (site.productSlugs.length === 0) return;
  if (dry) return;

  const compareCount = 4 + Math.floor(Math.random() * 2); // 4-5
  for (let i = 0; i < compareCount; i++) {
    const slug = randomItem(site.productSlugs);
    const productUrl = buildUrl(`${site.baseUrl}/products/${slug}`, utmParams);
    
    log(label, `comparing → ${productUrl}`);
    await page.goto(productUrl, { waitUntil: "domcontentloaded" });
    
    // long scroll
    await scrollPage(page);
    await scrollPage(page);
    
    await randomDelay(2000, 5000);
  }

  log(label, "comparison done — leaving without cart");
}
