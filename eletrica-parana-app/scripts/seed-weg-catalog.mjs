#!/usr/bin/env node
/**
 * Carrega o catálogo WEG (data/weg-products.json) na tabela products do Supabase.
 *
 * Idempotente: usa upsert por sap_code, então rodar várias vezes não duplica.
 *
 * Uso:
 *   1. Garanta que .env.local tem NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 *   2. Garanta que a migration 0002 foi aplicada no Supabase (adiciona sap_code/family)
 *   3. node scripts/seed-weg-catalog.mjs
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const JSON_PATH = path.join(ROOT, "data", "weg-products.json");

// Lê .env.local manualmente (sem dependência extra).
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Faltando NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local",
  );
  process.exit(1);
}

if (!fs.existsSync(JSON_PATH)) {
  console.error(`Arquivo não encontrado: ${JSON_PATH}`);
  console.error("Gere o JSON antes (npm run extract:weg).");
  process.exit(1);
}

/** @type {{sap_code:string,name:string,family:string|null,brand:string,sheet:string}[]} */
const products = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
console.log(`Carregando ${products.length} produtos...`);

const BATCH = 1000;
const ENDPOINT = `${SUPABASE_URL}/rest/v1/products?on_conflict=sap_code`;

let inserted = 0;
let failed = 0;

for (let i = 0; i < products.length; i += BATCH) {
  const chunk = products.slice(i, i + BATCH).map((p) => ({
    sap_code: p.sap_code,
    name: p.name,
    family: p.family ?? null,
    brand: p.brand,
    source: `weg-${p.sheet}-04-2026`,
  }));

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(chunk),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(
      `\nFalha no chunk ${i}-${i + chunk.length}: HTTP ${res.status}\n${body.slice(0, 500)}`,
    );
    failed += chunk.length;
  } else {
    inserted += chunk.length;
  }

  process.stdout.write(
    `\r${inserted}/${products.length} inseridos (falhas: ${failed})`,
  );
}

console.log("\nConcluído.");
process.exit(failed > 0 ? 1 : 0);
