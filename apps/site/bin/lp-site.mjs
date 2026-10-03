#!/usr/bin/env node
/**
 * lp-site build [dossier-client] — construit le Worker du site à partir de la configuration du repo client.
 * lp-site deploy [dossier-client] — déploie ce Worker avec le wrangler.jsonc du repo client.
 *
 * Le repo client ne contient aucun code : l'application est celle de @launchpadfactoryteam/site, à la version épinglée
 * dans son package.json. Elle est construite ici avec LP_SITE_DIR = dossier client, puis le
 * résultat (.open-next) est copié dans le repo client.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [command, dir = "."] = process.argv.slice(2);
const clientDir = resolve(dir);
const env = {
  ...process.env,
  LP_SITE_DIR: clientDir,
  PATH: [join(siteRoot, "node_modules/.bin"), process.env.PATH].join(delimiter),
};

function run(bin, args, cwd) {
  const result = spawnSync(bin, args, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(join(clientDir, "launchpad.config.yaml"))) {
  console.error(`Aucun launchpad.config.yaml dans ${clientDir}`);
  process.exit(2);
}

if (command === "build") {
  run("opennextjs-cloudflare", ["build"], siteRoot);
  run("node", [join(siteRoot, "scripts/worker-entry.mjs"), join(siteRoot, ".open-next")], siteRoot);
  rmSync(join(clientDir, ".open-next"), { recursive: true, force: true });
  cpSync(join(siteRoot, ".open-next"), join(clientDir, ".open-next"), { recursive: true });
  console.log(`Worker prêt dans ${join(clientDir, ".open-next")}`);
} else if (command === "deploy") {
  run("wrangler", ["deploy"], clientDir);
} else {
  console.error("Usage : lp-site build|deploy [dossier-client]");
  process.exit(2);
}
