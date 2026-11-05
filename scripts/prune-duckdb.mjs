// Supprime les binaires DuckDB inutilisés avant l'upload de l'artefact Pages.
//
// Le site ne livre qu'un seul bundle wasm (cf. `duckdb.platforms` dans
// observablehq.config.js), mais le framework copie toujours mvp *et* eh :
// ~35 Mo de fichiers jamais téléchargés par le navigateur.
import {readdir, rm} from "node:fs/promises";
import {join} from "node:path";
import config from "../observablehq.config.js";

const platforms = config.duckdb?.platforms ?? {};
const disabled = [];
if (platforms.eh === false) disabled.push("eh");
if (platforms.mvp === false) disabled.push("mvp");

if (disabled.length) {
  const root = "dist/_npm/@duckdb";
  let packages = [];
  try {
    packages = (await readdir(root)).filter((name) => name.startsWith("duckdb-wasm"));
  } catch {
    console.log("prune-duckdb: pas de paquet duckdb-wasm dans dist, rien à faire");
  }
  let removed = 0;
  for (const name of packages) {
    const dir = join(root, name, "dist");
    for (const file of await readdir(dir)) {
      if (disabled.some((platform) => file.includes(`-${platform}.`))) {
        await rm(join(dir, file), {force: true});
        removed++;
      }
    }
  }
  console.log(`prune-duckdb: ${removed} fichier(s) retiré(s) (plateformes non livrées : ${disabled.join(", ")})`);
}
