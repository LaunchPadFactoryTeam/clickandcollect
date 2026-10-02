/** lp-client-lint [dossier] — échoue si le repo client contient du code ou une surcharge non documentée. */
import { resolve } from "node:path";
import { lintClientRepo } from "./index.ts";

const root = resolve(process.argv[2] ?? ".");
const issues = lintClientRepo(root);
for (const issue of issues) console.error(`${issue.file} : ${issue.message}`);
if (issues.length) {
  console.error(`${issues.length} problème(s) dans le repo client ${root}`);
  process.exitCode = 1;
} else {
  console.log(`Repo client conforme : ${root}`);
}
