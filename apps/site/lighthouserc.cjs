// Budgets de performance du design system (section 11), vérifiés sur le Worker servi en local.
// Mobile milieu de gamme en 4G : préréglage mobile de Lighthouse, bridage appliqué (voir throttlingMethod).
const PORT = 3300;
// Fichier CommonJS lu par Lighthouse CI.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const product = require("./generated/content.json").catalog[0].slug;

module.exports = {
  ci: {
    collect: {
      startServerCommand: `pnpm exec opennextjs-cloudflare preview --port ${PORT}`,
      startServerReadyPattern: "Ready on",
      startServerReadyTimeout: 180000,
      url: [
        `http://localhost:${PORT}/`,
        `http://localhost:${PORT}/boutique`,
        `http://localhost:${PORT}/produits/${product}`,
      ],
      // Trois passages, la médiane est retenue : le bridage appliqué varie d'un passage à l'autre.
      numberOfRuns: 3,
      settings: {
        // Bridage réellement appliqué (4G lente, CPU ×4) plutôt que simulé : la simulation Lantern compte tout
        // le JavaScript dans le LCP même quand le texte est peint avant son exécution.
        throttlingMethod: "devtools",
        chromeFlags: "--no-sandbox --headless=new",
        onlyCategories: ["performance", "accessibility", "seo", "best-practices"],
      },
    },
    assert: {
      assertions: {
        "largest-contentful-paint": ["error", { maxNumericValue: 1800, aggregationMethod: "median" }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.05, aggregationMethod: "median" }],
        // INP ne se mesure pas en laboratoire : le temps de blocage total n'en est qu'un indicateur, en avertissement ;
        // le budget INP lui-même est vérifié sur l'ajout au panier (lot 4).
        "total-blocking-time": ["warn", { maxNumericValue: 200, aggregationMethod: "median" }],
        // JS initial ≤ 180 Kio compressés (runtime Next.js et React compris), poids hors images ≤ 280 Kio.
        "resource-summary:script:size": ["error", { maxNumericValue: 184320, aggregationMethod: "median" }],
        "resource-summary:third-party:count": ["error", { maxNumericValue: 0, aggregationMethod: "median" }],
        "categories:accessibility": ["error", { minScore: 1, aggregationMethod: "median" }],
        "categories:seo": ["error", { minScore: 1, aggregationMethod: "median" }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
