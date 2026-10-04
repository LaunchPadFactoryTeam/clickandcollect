# Core LaunchPad — développement

Monorepo du hub click & collect : tout le code partagé des sites clients. Les spécifications et le découpage
en lots sont dans le document « Hub Click & Collect — Spécifications techniques & note de développement ».
Les maquettes Claude Design d'origine sont dans `project/` et `chats/` (référence, non construites).

## Prérequis

- Node 22, pnpm 10 (`corepack enable`)
- Pour `pnpm test:db` en local : PostgreSQL 16 et pgTAP (`apt install postgresql-16 postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl`),
  ou une base Supabase locale (voir « Base de données »).

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

## Base de données (lot 2)

Migrations dans `packages/db/supabase/migrations`, données de démonstration dans `packages/db/supabase/seed.sql`
(générées par `node packages/db/scripts/generate-seed.mjs` depuis la maquette du back-office).

```sh
cd packages/db
npx supabase start -x realtime,storage-api,imgproxy,studio,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit
npx supabase db reset          # rejoue migrations et données de démonstration
pnpm types                     # régénère src/database.types.ts (vérifié en CI)
```

Avec la pile locale démarrée :

- `PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres pnpm test:db` : pgTAP et numérotation concurrente ;
- `LP_SUPABASE_URL=http://127.0.0.1:54321 LP_SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres LP_SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long pnpm --filter @launchpadfactoryteam/db exec vitest run` :
  tests d'intégration du jeton de site à travers l'API REST.

## Tunnel de paiement, emails et back-office en local (lots 5 à 7)

`node tools/scripts/dev-vars.mjs` écrit `apps/site/.dev.vars` : base locale, faux fournisseur de paiement, faux
prestataire d'emails et clé publique de Supabase Auth. Après `pnpm --filter @launchpadfactoryteam/site build:worker`
et `opennextjs-cloudflare preview`, le back-office est sur `/admin` avec le compte de démonstration
`commandes@maison-ferrand.fr` / `demo-maison-ferrand` (créé par `seed.sql`, base locale uniquement). Les commandes
de la maquette sont datées du jour du `db reset`. Tests de bout en bout : `E2E_TUNNEL=1 pnpm --filter @launchpadfactoryteam/site test:e2e`.

## Données personnelles (lot 8)

- Pages légales générées depuis la section `legal` de `launchpad.config.yaml` (`/mentions-legales`, `/cgv`,
  `/confidentialite`, `/cookies`, `/mes-droits`, `/accessibilite`).
- `pnpm --filter @launchpadfactoryteam/rgpd exec lp-rgpd documents <dossier du site>` : contrat de sous-traitance et
  fiche du registre des traitements, en Markdown.
- Durées de conservation appliquées le 1er de chaque mois par la tâche planifiée du Worker (`/api/rgpd/conservation`).
- Accès et effacement, en attendant le hub, depuis l'éditeur SQL de Supabase :
  `select public.export_customer_data('<id de la boutique>', 'client@exemple.fr');` et
  `select public.erase_customer_data('<id de la boutique>', 'client@exemple.fr');` (journalisés dans `privacy_requests`).

Sans pile Supabase, `pnpm test:db` crée un Postgres jetable et reproduit les rôles et le schéma `auth` de Supabase
(`packages/db/test/support/supabase-shim.psql`).

## Organisation

- `packages/*` : paquets du core (`config`, `theme`, `db`, `content`, puis les paquets réservés aux lots suivants).
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
