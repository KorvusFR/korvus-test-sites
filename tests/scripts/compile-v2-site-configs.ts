// Compile les configs V2 des sites de test, par le vrai chemin du pipeline de
// platform (validateSiteConfigSource + fragments partages), pour que la recette
// E2E charge chaque site comme un vrai client V2 : config posee sur
// window.__korvusSite AVANT le moteur (cf. tests/helpers/inject-snippet.ts).
//
// A lancer depuis le checkout platform, avec son tsx (alias @/ et fragments) :
//   cd platform && npx tsx ../test_website/tests/scripts/compile-v2-site-configs.ts <dossier de sortie>
//
// Sortie : un fichier <websiteId>.json par site de test, contenant l'objet publie.

import fs from "node:fs"
import path from "node:path"

// Sites de test et leur config V2. `pilot` = config/sites/<slug>.json de platform
// (un faux site Korvus qui a sa vraie config) ; sinon config minimale : langue et
// plateforme du site, comme en aurait un client qui vient d'installer la balise.
const TEST_SITES: Record<string, { pilot: string } | { langs: string[]; platform?: string }> = {
  // doomcheck.me : config V2 reelle (config/sites/doomcheck-me.json).
  "00000000-0000-4000-a000-000000001013": { pilot: "doomcheck-me" },
  // athletedatahub : site custom anglais.
  "00000000-0000-4000-a000-000000001010": { langs: ["en"] },
}

async function main(): Promise<void> {
  const outDir = path.resolve(process.argv[2] ?? "")
  if (!process.argv[2]) throw new Error("usage : compile-v2-site-configs.ts <dossier de sortie>")
  const helper = (await import(
    path.join(process.cwd(), "tests/unit/snippet/_helpers/site-config-files.ts")
  )) as {
    publishedPilotConfig: (slug: string) => unknown
    publishedSiteConfig: (input: { langs: string[]; platform?: string }) => unknown
  }
  fs.mkdirSync(outDir, { recursive: true })
  for (const [websiteId, spec] of Object.entries(TEST_SITES)) {
    const published =
      "pilot" in spec ? helper.publishedPilotConfig(spec.pilot) : helper.publishedSiteConfig(spec)
    fs.writeFileSync(path.join(outDir, `${websiteId}.json`), JSON.stringify(published))
    console.log(`config V2 compilee : ${websiteId} (${"pilot" in spec ? spec.pilot : spec.langs.join(",")})`)
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
