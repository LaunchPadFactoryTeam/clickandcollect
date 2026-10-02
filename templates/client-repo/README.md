# Site client LaunchPad

Ce repo ne contient que la configuration (`launchpad.config.yaml`), les assets (logo SVG, polices WOFF2)
et la configuration de déploiement (`wrangler.jsonc`). Le code vient de `@launchpadfactoryteam/site`, à la version épinglée
dans `package.json` ; une montée de version du core se fait en changeant ce seul numéro.

- `pnpm lint` : refuse tout fichier de code (`.ts`, `.tsx`, `.js`…) et toute surcharge CSS non documentée.
  Une surcharge autorisée vit dans `styles/` et commence par `/* Surcharge documentée : <raison> */`.
- `pnpm build` : valide la configuration, contrôle les contrastes et construit le Worker dans `.open-next/`.
- `pnpm deploy` : déploie le Worker sur Cloudflare.
