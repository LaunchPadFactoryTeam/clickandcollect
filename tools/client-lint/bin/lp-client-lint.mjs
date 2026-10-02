#!/usr/bin/env node
// Point d'entrée exécutable : les paquets du core sont publiés en TypeScript source, chargé via tsx.
import { register } from "tsx/esm/api";

register();
await import("../src/cli.ts");
