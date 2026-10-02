// Tous les paquets du monorepo partagent la version du core (section 1.2).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = JSON.parse(readFileSync("package.json", "utf8"));
const errors = [];
for (const group of ["packages", "apps", "tools"]) {
  for (const name of readdirSync(group)) {
    const file = join(group, name, "package.json");
    if (!existsSync(file)) continue;
    const pkg = JSON.parse(readFileSync(file, "utf8"));
    if (pkg.version !== root.version) errors.push(`${pkg.name} est en ${pkg.version}, le core en ${root.version}`);
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Tous les paquets sont en ${root.version}.`);
