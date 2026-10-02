// Budgets de performance du design system (section 1.12), vérifiés sur le Worker servi en local.
// Mobile milieu de gamme en 4G simulée : préréglage mobile de Lighthouse.
const PORT = 3300;
const product = require("./generated/content.json").catalog[0].slug;

module.exports = {
  ci: {
    collect: {
      startServerCommand: `pnpm exec opennextjs-cloudflare preview --port ${PORT}`,
      startServerReadyPattern: "Ready on",
      startServerReadyTimeout: 180000,
      url: [`http://localhost:${PORT}/`, `http://localhost:${PORT}/boutique`, `http://localhost:${PORT}/produits/${product}`],
      numberOfRuns: 1,
      settings: {
        chromeFlags: "--no-sandbox --headless=new",
        onlyCategories: ["performance", "accessibility", "seo", "best-practices"],
      },
    },
    assert: {
      assertions: {
        "largest-contentful-paint": ["error", { maxNumericValue: 1800 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.05 }],
        // INP ne se mesure pas en laboratoire : le temps de blocage total sert d'indicateur.
        "total-blocking-time": ["error", { maxNumericValue: 200 }],
        "resource-summary:script:size": ["error", { maxNumericValue: 92160 }],
        "resource-summary:third-party:count": ["error", { maxNumericValue: 0 }],
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:seo": ["error", { minScore: 1 }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
