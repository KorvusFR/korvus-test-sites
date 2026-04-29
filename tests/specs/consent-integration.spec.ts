import { test, expect, type Page } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"

// =============================================================================
// Consent integration — Refacto consent.ts (etape 2 vague D)
// =============================================================================
//
// Objectif : prouver qu'AUCUNE regression de comportement n'a ete introduite
// par le refacto architectural de [consent.ts](../../../platform/snippet/src/consent.ts)
// (Runner + DetectorResult + priority fusion + cleanup agrege) sur des sites
// reels avec CMPs injectees en page.
//
// 6 specs couvrant les classes critiques :
//   1. Baseline — pas de CMP du tout
//   2. Cookiebot granted (Tier 1, structure decidee)
//   3. Didomi denied (Tier 1, anti-false-grant CNIL)
//   4. GCM v2 via dataLayer.push (Tier 2, regression cas Iubenda)
//   5. Axeptio AMBIGU + GCM granted parallele (LE bug de classe que le
//      refacto fixe : avant, l'ambiguite Axeptio court-circuitait GCM via ||)
//   6. Revocation Cookiebot mid-session (cleanup callback wrap, identity check)
//
// Pattern : pour chaque test, inject les globals CMP via addInitScript AVANT
// le boot du snippet, puis assert que session.consent_status reflete bien
// l'etat reel. Utilise doomcheck (port 3003) pour cohérence avec
// consent-cmps.spec.ts (matrice cross-engine Chrome+Safari+Firefox+Mobile).

const doomcheck = getSiteConfig("doomcheck")

// Helper : pousse un purchase via dataLayer puis force le flush du buffer.
// Utilise quand le test doit verifier le passage du consent gate (granted).
async function pushPurchaseAndFlush(
  page: Page,
  interceptor: IngestInterceptor,
  transactionId: string,
): Promise<void> {
  await page.evaluate((txId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dl = ((window as any).dataLayer ||= [])
    dl.push({
      event: "purchase",
      ecommerce: {
        transaction_id: txId,
        value: 49.99,
        currency: "EUR",
        items: [
          { item_id: "INTEG-A", item_name: "Integ Test", price: 49.99, quantity: 1 },
        ],
      },
    })
  }, transactionId)
  await page.waitForTimeout(400)
  await interceptor.triggerFlush()
}

// Helper : pousse un js_error (event exempt CNIL) pour forcer un POST batch
// apres une revocation. Necessaire car post-revoke le datalayer collector est
// detruit et les events consent-gated sont droppes → pas de flush sans event
// exempt → interceptor.getSession() reste undefined.
async function pushExemptErrorAndFlush(
  page: Page,
  interceptor: IngestInterceptor,
  marker: string,
): Promise<void> {
  await page.evaluate((msg: string) => {
    window.dispatchEvent(
      new ErrorEvent("error", {
        message: msg,
        filename: "consent-integ.js",
        lineno: 1,
        colno: 1,
        error: new Error(msg),
      }),
    )
  }, marker)
  await page.waitForTimeout(400)
  await interceptor.triggerFlush()
}

// ---------------------------------------------------------------------------
// Spec 1 — Baseline : pas de CMP → consent_status = "unknown"
// ---------------------------------------------------------------------------
//
// Aucune CMP injectee, aucun cookie consent, pas de GCM dataLayer entry.
// Le runner doit poller jusqu'a 10s puis stop avec status = "unknown".
// On flush rapidement (avant 10s) : sans CMP detectable, le status est
// deja "unknown" cote bus → la session payload doit refleter ca.

test.describe("Spec 1 — Baseline (no CMP)", () => {
  test("aucune CMP → session.consent_status = 'unknown'", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/")
    // Laisse le snippet booter, faire son detection initiale, et attendre un
    // peu de polling. Pas besoin d'attendre 10s — sans aucun signal CMP, le
    // status initial est "unknown" et le restera.
    await page.waitForTimeout(2000)

    // Push un js_error (exempt CNIL) pour avoir un event a flusher.
    await pushExemptErrorAndFlush(page, interceptor, "baseline-no-cmp")

    const session = interceptor.getSession()
    expect(session, "session should be captured").toBeDefined()
    expect(
      session!.consent_status,
      "Without any CMP, consent_status must default to 'unknown'",
    ).toBe("unknown")
  })
})

// ---------------------------------------------------------------------------
// Spec 2 — Cookiebot granted (Tier 1)
// ---------------------------------------------------------------------------
//
// window.Cookiebot.consent.statistics = true → detection Tier 1 decidee
// granted. Pas d'autre CMP, pas de GCM. Le runner doit publier "granted"
// via le merge initial sync.

test.describe("Spec 2 — Cookiebot granted", () => {
  test("Cookiebot consent.statistics=true → granted", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.Cookiebot = {
        consent: {
          statistics: true,
          marketing: true,
          preferences: true,
          necessary: true,
        },
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-INTEG-COOKIEBOT")

    const session = interceptor.getSession()
    expect(session, "session should be captured").toBeDefined()
    expect(
      session!.consent_status,
      "Cookiebot statistics=true → granted",
    ).toBe("granted")

    const purchase = interceptor
      .getEvents("purchase")
      .find((e) => e.payload.transaction_id === "TX-INTEG-COOKIEBOT")
    expect(
      purchase,
      "purchase should pass consent gate under Cookiebot granted",
    ).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Spec 3 — Didomi denied (Tier 1)
// ---------------------------------------------------------------------------
//
// Didomi avec getUserConsentStatusForPurpose() retournant false explicite.
// notice.isVisible()=false + isConsentRequired()=true → user a interagi et
// refuse. Le runner doit publier "denied" via Tier 1 decide.
//
// Critique : pre-refacto, certains setups Didomi ambigus (notice visible,
// pas de purpose conf) defaultaient a granted ou unknown selon l'ordre des
// detecteurs. Avec le runner, denied Tier 1 doit gagner.

test.describe("Spec 3 — Didomi denied", () => {
  test("Didomi getUserConsentStatusForPurpose=false + interacted → denied", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.Didomi = {
        getUserConsentStatusForPurpose: (_purpose: string) => false,
        on: (_event: string, _cb: () => void) => undefined,
        // User a deja interagi (notice fermee) + GDPR applicable → on lit
        // getUserConsentStatusForPurpose pour decision finale.
        isConsentRequired: () => true,
        notice: { isVisible: () => false },
      }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/")
    await page.waitForTimeout(1500)

    // On utilise un js_error exempt pour flusher, car post-denied le
    // datalayer collector ne s'init pas et un purchase ne donne aucun event.
    await pushExemptErrorAndFlush(page, interceptor, "didomi-denied")

    const session = interceptor.getSession()
    expect(session, "session should be captured").toBeDefined()
    expect(
      session!.consent_status,
      "Didomi denied → session.consent_status must be 'denied'",
    ).toBe("denied")

    // Sanity check : un purchase pousse SOUS denied ne doit pas passer.
    interceptor.clear()
    await pushPurchaseAndFlush(page, interceptor, "TX-DIDOMI-BLOCKED")
    const blocked = interceptor
      .getEvents("purchase")
      .find((e) => e.payload.transaction_id === "TX-DIDOMI-BLOCKED")
    expect(
      blocked,
      "purchase under Didomi denied must be blocked by consent gate",
    ).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Spec 4 — GCM v2 via dataLayer.push (regression Iubenda fix)
// ---------------------------------------------------------------------------
//
// dataLayer pre-rempli avec ["consent", "update", { analytics_storage:
// "granted" }]. Le snippet doit lire l'entry consent du dataLayer (Tier 2
// GCM v2) et publier "granted". Aucune CMP Tier 1 ne masque le signal.
//
// Critique : le bug de classe Iubenda etait que la chaine || court-circuitait
// le scan GCM dataLayer des qu'un detecteur Tier 1 trouvait sa CMP, meme
// ambigue. Ici on teste que sans Tier 1, le scan GCM marche tel quel.
//
// Sentinelle CNIL : la commande GCM "default" est explicitement rejetee par
// le snippet (privacy review 2026-04-28). "default" est la pre-config dev
// avant decision utilisateur, pas un signal de consentement. Un site EU
// configure avec `default granted` (illegal art. 82 LIL) ne doit PAS faire
// passer le visiteur en "granted". Le 2e test ci-dessous cimente cette
// rejection : si un futur changement re-accepte "default", il echoue.

test.describe("Spec 4 — GCM v2 via dataLayer.push", () => {
  test("dataLayer consent update analytics_storage=granted → granted", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.dataLayer = [
        ["consent", "update", { analytics_storage: "granted", ad_storage: "granted" }],
      ]
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/")
    await page.waitForTimeout(1500)

    await pushPurchaseAndFlush(page, interceptor, "TX-INTEG-GCM")

    const session = interceptor.getSession()
    expect(session, "session should be captured").toBeDefined()
    expect(
      session!.consent_status,
      "GCM dataLayer analytics_storage=granted → session.consent_status = granted",
    ).toBe("granted")

    const purchase = interceptor
      .getEvents("purchase")
      .find((e) => e.payload.transaction_id === "TX-INTEG-GCM")
    expect(
      purchase,
      "purchase should pass consent gate under GCM granted",
    ).toBeDefined()
  })

  test("dataLayer consent default analytics_storage=granted → unknown (CNIL sentinelle)", async ({
    page,
  }) => {
    // Pousser ["consent", "default", { analytics_storage: "granted" }] doit
    // etre IGNORE par le snippet : "default" est la config developpeur avant
    // interaction utilisateur, pas un signal de consentement valide. Le
    // session.consent_status doit rester "unknown" (aucun autre signal CMP)
    // et un purchase doit etre BLOQUE par le consent gate.
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.dataLayer = [
        ["consent", "default", { analytics_storage: "granted", ad_storage: "granted" }],
      ]
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/")
    await page.waitForTimeout(1500)

    // Exempt event pour flusher et capturer la session : sous "unknown" un
    // purchase serait bloque par le consent gate -> aucun batch envoye ->
    // getSession() reste undefined. Meme pattern que Spec 3 (Didomi denied).
    await pushExemptErrorAndFlush(page, interceptor, "gcm-default-rejected")

    const session = interceptor.getSession()
    expect(session, "session should be captured").toBeDefined()
    expect(
      session!.consent_status,
      "GCM 'default' command must be rejected → consent_status stays 'unknown'",
    ).toBe("unknown")

    // Sanity check : un purchase pousse sous "unknown" doit etre bloque.
    interceptor.clear()
    await pushPurchaseAndFlush(page, interceptor, "TX-INTEG-GCM-DEFAULT")
    const blocked = interceptor
      .getEvents("purchase")
      .find((e) => e.payload.transaction_id === "TX-INTEG-GCM-DEFAULT")
    expect(
      blocked,
      "purchase under 'default'-only signal must be blocked by consent gate",
    ).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Spec 5 — Axeptio AMBIGU + GCM granted parallele (LE test critique)
// ---------------------------------------------------------------------------
//
// CONTEXTE BUG : Axeptio configure avec un service NON-analytique
// (facebook_pixel:true mais google_analytics absent) → detector Axeptio
// retourne `detected:true, status:null` (CMP presente mais ambiguë : on ne
// sait pas si analytics est consenti).
//
// Avant le refacto : la chaine `||` court-circuitait des que detectAxeptio()
// retournait true → GCM jamais consulte → consent_status = "unknown" a vie.
// Apres le refacto : le runner agrege Tier 1 (Axeptio = null/ambigu) +
// Tier 2 (GCM = granted decide) → priority fusion → "granted".
//
// CE TEST PROUVE QUE LE BUG DE CLASSE EST MORT.

test.describe("Spec 5 — Axeptio ambigu + GCM granted parallele", () => {
  test("Axeptio sans service analytics + GCM granted → granted (via GCM)", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any

      // Axeptio AMBIGU : aucun service analytique declare. Le detector va
      // retourner detected:true mais status:null (impossible de decider).
      w._axcb = []
      w.axeptio_settings = {
        cookies: {
          facebook_pixel: true,
          // ni google_analytics ni statistics ni analytics → ambigu
        },
      }

      // GCM v2 parallele : analytics_storage=granted decide.
      w.dataLayer = [
        ["consent", "update", { analytics_storage: "granted" }],
      ]
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/")
    await page.waitForTimeout(2000)

    await pushPurchaseAndFlush(page, interceptor, "TX-AXEPTIO-AMBIG-GCM")

    const session = interceptor.getSession()
    expect(session, "session should be captured").toBeDefined()
    // L'assertion CRITIQUE : Axeptio ambigu ne doit PAS court-circuiter
    // GCM. Le runner doit consulter GCM et publier "granted".
    expect(
      session!.consent_status,
      "Axeptio ambigu doit ceder a GCM granted (regression cas Iubenda)",
    ).toBe("granted")

    const purchase = interceptor
      .getEvents("purchase")
      .find((e) => e.payload.transaction_id === "TX-AXEPTIO-AMBIG-GCM")
    expect(
      purchase,
      "purchase doit passer le gate consent (GCM granted lu malgre Axeptio ambigu)",
    ).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Spec 6 — Revocation Cookiebot mid-session
// ---------------------------------------------------------------------------
//
// Phase 1 : Cookiebot granted → snippet boot → session.consent_status =
// "granted". Push un purchase pour confirmer le passage du gate.
// Phase 2 : appel CookiebotCallback_OnDecline() (callback wrappe par le
// snippet pendant detectCookiebot). Le wrapper doit appeler
// notifyUpdate("denied") → runner re-merge → setStatus("denied").
// Phase 3 : push un js_error exempt → flush → assert session.consent_status
// est passe a "denied". Le purchase post-revoke ne doit pas passer.
//
// Verifie le pattern cleanup wrap + identity check du refacto.

test.describe("Spec 6 — Revocation Cookiebot mid-session", () => {
  test("Cookiebot granted → OnDecline → denied", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.Cookiebot = {
        consent: {
          statistics: true,
          marketing: true,
          preferences: true,
          necessary: true,
        },
      }
      // Pre-set les slots a null pour que le snippet detecte qu'il peut
      // wrapper sans clobber un handler client existant.
      w.CookiebotCallback_OnAccept = null
      w.CookiebotCallback_OnDecline = null
      w.CookiebotCallback_OnLoad = null
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await page.goto("/")
    await page.waitForTimeout(1500)

    // --- Phase 1 : granted ---
    await pushPurchaseAndFlush(page, interceptor, "TX-CB-INTEG-BEFORE")
    let session = interceptor.getSession()
    expect(
      session?.consent_status,
      "Phase 1 : Cookiebot granted → session.consent_status = granted",
    ).toBe("granted")
    const beforePurchase = interceptor
      .getEvents("purchase")
      .find((e) => e.payload.transaction_id === "TX-CB-INTEG-BEFORE")
    expect(
      beforePurchase,
      "Phase 1 : purchase must pass under Cookiebot granted",
    ).toBeDefined()

    interceptor.clear()

    // --- Phase 2 : revocation ---
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      // Update l'etat Cookiebot comme en prod sur un refus utilisateur.
      w.Cookiebot.consent.statistics = false
      w.Cookiebot.consent.marketing = false
      // Fire le callback wrappe par detectCookiebot. Le wrapper doit appeler
      // notifyUpdate("denied") → runner re-merge → setStatus("denied").
      if (typeof w.CookiebotCallback_OnDecline === "function") {
        w.CookiebotCallback_OnDecline()
      }
    })
    await page.waitForTimeout(300)

    // --- Phase 3 : assert denied ---
    await pushExemptErrorAndFlush(page, interceptor, "post-revoke-CB-integ")
    session = interceptor.getSession()
    expect(
      session?.consent_status,
      "Phase 3 : post-revoke session.consent_status must be 'denied'",
    ).toBe("denied")

    // Sanity : un purchase post-revoke ne doit pas passer.
    interceptor.clear()
    await pushPurchaseAndFlush(page, interceptor, "TX-CB-INTEG-AFTER")
    const afterPurchase = interceptor
      .getEvents("purchase")
      .find((e) => e.payload.transaction_id === "TX-CB-INTEG-AFTER")
    expect(
      afterPurchase,
      "Phase 3 : purchase post-revoke must be blocked by consent gate",
    ).toBeUndefined()
  })
})
