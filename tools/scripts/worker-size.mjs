// Mesure la taille compressée du Worker d'une application OpenNext (après `build:worker`)
// et échoue au-delà de la limite. Usage : node tools/scripts/worker-size.mjs apps/site [limite-en-Kio]
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const app = process.argv[2] ?? "apps/site";
// 3 Mo : limite du plan gratuit, visée pour le site vide du lot 0. Le plan payant monte à 10 Mo.
const limitKiB = Number(process.argv[3] ?? process.env.LP_WORKER_LIMIT_KIB ?? 3072);

const out = execFileSync(
  "pnpm",
  ["exec", "wrangler", "deploy", "--dry-run", "--outdir", mkdtempSync(join(tmpdir(), "worker-"))],
  {
    cwd: app,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const match = /Total Upload: ([\d.]+) KiB \/ gzip: ([\d.]+) KiB/.exec(out);
if (!match) {
  console.error("Taille du Worker introuvable dans la sortie de wrangler :\n" + out);
  process.exit(2);
}
const [raw, gzip] = [Number(match[1]), Number(match[2])];
const line = `Worker ${app} : ${gzip.toFixed(0)} Kio compressés (${raw.toFixed(0)} Kio bruts), limite ${limitKiB} Kio`;
console.log(line);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Taille du Worker\n\n${line}\n`);
if (gzip > limitKiB) {
  console.error("Limite dépassée.");
  process.exit(1);
}
