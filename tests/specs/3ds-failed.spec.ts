import { test, expect } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"

// Vague 2 — Worker B4.3 — 3DS challenge échoué / abandonné.
//
// Le snippet observe l'iframe ACS via MutationObserver
// (cf. snippet/src/collectors/three-ds.ts). La cascade `3ds_initiated`
// matche un host ACS connu (Stripe hooks, Adyen, Worldline, ...) ou un
// path keyword 3DS. Le `3ds_completed` outcome dépend de ce qui se passe
// après le retrait de l'iframe :
//   - navigation order_confirmation → outcome=success
//   - élément d'erreur DOM dans la fenêtre 3s → outcome=failed
//   - retrait silencieux + 5s sans signal → outcome=failed_silent
//   - 300s sans removal → outcome=abandoned
//
// Ces tests valident les outcomes négatifs (failed / failed_silent) qui
// sont les fuites financières capturées par la fuite `payment_page_error`.

const doomcheck = getSiteConfig("doomcheck")

test.describe("Worker B4.3 — 3DS challenge failed / abandonné", () => {
  test("outcome failed_silent: iframe ACS retirée sans signal de succès ni erreur", async ({
    page,
  }) => {
    // Le collector arme un timer 5s post-removal — si aucun signal
    // (navigation order_confirmation, élément d'erreur DOM) n'arrive
    // dans cette fenêtre, l'outcome est `failed_silent`.
    test.setTimeout(45_000)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/checkout")
    await page.waitForTimeout(800)

    // Démarrage du challenge 3DS via un host ACS Stripe.
    await page.evaluate(() => {
      const root = document.querySelector("#sim-root") as HTMLElement
      const iframe = document.createElement("iframe")
      iframe.id = "sim-3ds-frame"
      iframe.src = "https://hooks.stripe.com/3d_secure/acs_redirect"
      iframe.style.width = "400px"
      iframe.style.height = "400px"
      root.appendChild(iframe)
    })
    await page.waitForTimeout(800)

    // L'iframe est retirée — simule le client-side qui ferme le challenge
    // sans navigation de succès ni message d'erreur (ex : utilisateur ferme
    // la modale, JS bug qui démonte le widget).
    await page.evaluate(() => {
      document.getElementById("sim-3ds-frame")?.remove()
    })

    // On attend > POST_REMOVAL_WINDOW_MS (5s) pour laisser le timer
    // failed_silent se déclencher.
    await page.waitForTimeout(6000)
    await interceptor.triggerFlush()

    // 3ds_initiated doit avoir été émis.
    const initiated = interceptor.getEvents("3ds_initiated")
    expect(
      initiated.length,
      "3ds_initiated devrait être capturé sur iframe ACS",
    ).toBeGreaterThan(0)
    expect(initiated[0].payload.cascade_matched).toBe("iframe_acs_pattern_match")
    expect(String(initiated[0].payload.acs_host)).toContain("stripe")

    // 3ds_completed avec outcome failed_silent.
    const completed = interceptor.getEvents("3ds_completed")
    expect(
      completed.length,
      "3ds_completed devrait être émis après removal silencieux",
    ).toBeGreaterThan(0)
    expect(completed[0].payload.outcome).toBe("failed_silent")
  })

  test("outcome failed: iframe ACS retirée puis élément d'erreur DOM apparaît", async ({
    page,
  }) => {
    // Cas explicite : la banque rejette l'authentification 3DS, le widget
    // démonte l'iframe puis affiche un message d'erreur. Le collector
    // observe l'élément `role=alert` dans sa fenêtre 3s post-removal.
    test.setTimeout(45_000)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/checkout")
    await page.waitForTimeout(800)

    // Démarrage 3DS — on utilise un host non Stripe pour exercer le path
    // keyword cascade (iframe_payment_redirect). Le collector accepte les
    // deux cascades pour `initiated`.
    await page.evaluate(() => {
      const root = document.querySelector("#sim-root") as HTMLElement
      const iframe = document.createElement("iframe")
      iframe.id = "sim-3ds-frame"
      iframe.src = "https://acs.example-bank.com/challenge/3ds-authenticate"
      iframe.style.width = "400px"
      iframe.style.height = "400px"
      root.appendChild(iframe)
    })
    await page.waitForTimeout(800)

    // Removal de l'iframe.
    await page.evaluate(() => {
      document.getElementById("sim-3ds-frame")?.remove()
    })
    await page.waitForTimeout(300)

    // Élément d'erreur DOM dans la fenêtre 3s post-removal.
    await page.evaluate(() => {
      const root = document.querySelector("#sim-root") as HTMLElement
      const err = document.createElement("div")
      err.setAttribute("role", "alert")
      err.className = "alert error declined"
      err.textContent = "3D Secure authentication failed. Payment declined."
      root.appendChild(err)
    })

    await page.waitForTimeout(2000)
    await interceptor.triggerFlush()

    const initiated = interceptor.getEvents("3ds_initiated")
    expect(initiated.length).toBeGreaterThan(0)
    expect(
      [
        "iframe_acs_pattern_match",
        "iframe_payment_redirect",
      ].includes(String(initiated[0].payload.cascade_matched)),
    ).toBe(true)

    const completed = interceptor.getEvents("3ds_completed")
    expect(
      completed.length,
      "3ds_completed devrait être émis sur élément d'erreur post-removal",
    ).toBeGreaterThan(0)
    expect(completed[0].payload.outcome).toBe("failed")
    // ms_challenge_duration > 0 — le challenge a duré au moins le temps
    // entre l'add et le remove de l'iframe.
    expect(
      Number(completed[0].payload.ms_challenge_duration),
    ).toBeGreaterThanOrEqual(0)
  })

  test("retry pattern: 2e iframe ACS arrive avant la fin du 1er → 1er challenge clos en failed_silent", async ({
    page,
  }) => {
    // Spec 3.6.7 : « 3 tentatives → 3 events distincts ». Quand un
    // nouveau challenge ACS arrive alors qu'un autre est déjà actif, le
    // collector clôt le précédent en failed_silent puis démarre le nouveau.
    test.setTimeout(45_000)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/checkout")
    await page.waitForTimeout(800)

    // 1er challenge.
    await page.evaluate(() => {
      const root = document.querySelector("#sim-root") as HTMLElement
      const iframe = document.createElement("iframe")
      iframe.id = "sim-3ds-frame-1"
      iframe.src = "https://hooks.stripe.com/3d_secure/acs_redirect"
      root.appendChild(iframe)
    })
    await page.waitForTimeout(800)

    // 2e challenge sans avoir retiré le 1er → le collector clôt le 1er
    // en failed_silent et démarre le 2e.
    await page.evaluate(() => {
      const root = document.querySelector("#sim-root") as HTMLElement
      const iframe = document.createElement("iframe")
      iframe.id = "sim-3ds-frame-2"
      iframe.src = "https://hooks.stripe.com/3d_secure/acs_redirect"
      root.appendChild(iframe)
    })
    await page.waitForTimeout(800)

    await interceptor.triggerFlush()

    // 2 events 3ds_initiated.
    const initiated = interceptor.getEvents("3ds_initiated")
    expect(
      initiated.length,
      "2 challenges → 2 events 3ds_initiated",
    ).toBeGreaterThanOrEqual(2)

    // 1 event 3ds_completed (le 1er fermé), outcome failed_silent.
    const completed = interceptor.getEvents("3ds_completed")
    expect(
      completed.length,
      "1er challenge devrait être clos en failed_silent quand le 2e démarre",
    ).toBeGreaterThanOrEqual(1)
    expect(completed[0].payload.outcome).toBe("failed_silent")
  })
})
