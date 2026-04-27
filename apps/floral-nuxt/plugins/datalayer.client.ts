declare global {
  interface Window {
    dataLayer: Array<Record<string, unknown> | unknown[]>
  }
}

// Initialise dataLayer ASAP côté client. Volontairement minimal : on ne push
// PAS d'events GTM-like car ils interfèrent avec la séquence de boot du
// snippet (le collector wrap dataLayer.push une fois consent détecté ; le
// pré-fill peut décaler la timing du wrap si le pageview emit le boot
// dataLayer collector vers `skipReplay: true` quand le statut consent
// arrive après l'init).
export default defineNuxtPlugin(() => {
  if (typeof window === "undefined") return
  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = []
  }
})
