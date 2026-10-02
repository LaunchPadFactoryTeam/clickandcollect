# Core LaunchPad — développement

Monorepo du hub click & collect : tout le code partagé des sites clients. Les spécifications et le découpage
en lots sont dans le document « Hub Click & Collect — Spécifications techniques & note de développement ».
Les maquettes Claude Design d'origine sont dans `project/` et `chats/` (référence, non construites).

## Prérequis

- Node 22, pnpm 10 (`corepack enable`)
- Pour `pnpm test:db` en local : PostgreSQL 16 et pgTAP (`apt install postgresql-16 postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl`),
  ou une base Supabase locale (`supabase db start` dans `packages/db`, puis `PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGPASSWORD=postgres`).

## Commandes

| Commande                                                          | Effet                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm install`                                                    | Installe tout le monorepo                                                 |
| `pnpm lint` / `pnpm format:check`                                 | ESLint et Prettier                                                        |
| `pnpm typecheck`                                                  | TypeScript strict, paquet par paquet                                      |
| `pnpm test`                                                       | Tests unitaires (Vitest)                                                  |
| `pnpm test:db`                                                    | Tests de base de données (pgTAP) de `packages/db`                         |
| `pnpm turbo run build:worker --filter=@launchpadfactoryteam/site` | Construit le site de démonstration et son Worker Cloudflare (OpenNext)    |
| `pnpm worker:size`                                                | Mesure le Worker compressé et échoue au-delà de 3 Mo                      |
| `pnpm --filter @launchpadfactoryteam/site test:e2e`               | Tests de bout en bout (Playwright) sur le Worker servi en local           |
| `pnpm --filter @launchpadfactoryteam/site dev`                    | Site de démonstration en développement                                    |
| `pnpm themes`                                                     | Thème et page de contrôle des trois exemples dans `examples/*/dist/theme` |
| `pnpm versions:check`                                             | Vérifie que tous les paquets portent la version du core                   |

`LP_SITE_DIR=<dossier>` construit le site sur une autre configuration (par défaut `examples/maison-ferrand`).
La page de contrôle du thème est servie sous `/theme/preview.html`.

## Organisation

- `packages/*` : paquets du core (`@launchpadfactoryteam/config`, `@launchpadfactoryteam/theme`, puis les paquets réservés aux lots suivants).
- `apps/site` : application Next.js de tous les sites (`@launchpadfactoryteam/site`, commande `lp-site build|deploy`).
- `tools/client-lint` : règle qui refuse tout code dans un repo client (`lp-client-lint`).
- `templates/client-repo` : gabarit d'un repo client (configuration, assets, wrangler, CI).
- `examples/*` : trois configurations reprises des maquettes A, B et C.

## Règle d'or

Un repo client ne contient que `launchpad.config.yaml`, ses assets et `wrangler.jsonc`. Toute fonctionnalité se
développe ici, derrière un interrupteur `features`. Seule exception : une surcharge CSS dans `styles/`, dont la
première ligne est `/* Surcharge documentée : <raison> */`.

## Mise en service (actions hors dépôt)

1. Pousser ce dépôt sur GitHub et protéger `main` avec les statuts requis « qualité », « base de données », « site ».
2. Secrets du dépôt : `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` ; créer le bucket R2 `lp-demo-opennext-cache`.
3. Publication : une étiquette `vX.Y.Z` égale à la version du core publie les paquets `@launchpadfactoryteam/*`
   sur GitHub Packages (la portée npm est le nom de l'organisation GitHub, en minuscules).
