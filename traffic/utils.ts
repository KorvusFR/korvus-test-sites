import type { Page } from "playwright";

export function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildUrl(
  base: string,
  params: Record<string, string>
): string {
  const filtered = Object.entries(params).filter(([, v]) => Boolean(v));
  if (filtered.length === 0) return base;
  const qs = new URLSearchParams(filtered).toString();
  return `${base}${base.includes("?") ? "&" : "?"}${qs}`;
}

export async function scrollPage(page: Page): Promise<void> {
  const scrolls = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < scrolls; i++) {
    await page.evaluate(() => {
      const step = 200 + Math.floor(Math.random() * 300);
      window.scrollBy(0, step);
    });
    await randomDelay(300, 800);
  }
}

export function log(label: string, message: string): void {
  const ts = new Date().toISOString().substring(11, 23);
  console.log(`[${ts}] ${label} ${message}`);
}

export function pickScenario(distribution: Record<string, number>): string {
  const r = Math.random();
  let cum = 0;
  const entries = Object.entries(distribution) as Array<
    [keyof typeof distribution, number]
  >;
  for (const [key, weight] of entries) {
    cum += weight;
    if (r < cum) return key;
  }
  return entries[0][0]; // default fallback
}

export async function safeClick(
  page: Page,
  selector: any, // string or Locator
  timeout = 5000
): Promise<boolean> {
  try {
    const loc = typeof selector === "string" ? page.locator(selector).first() : selector.first();
    await loc.waitFor({ state: "visible", timeout });
    await loc.click({ timeout });
    return true;
  } catch (e) {
    let locatorName = typeof selector === "string" ? selector : "Locator";
    log("safeClick", `warning: element not found or not clickable — ${locatorName}`);
    return false;
  }
}
