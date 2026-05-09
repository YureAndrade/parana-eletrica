#!/usr/bin/env node
/**
 * Extrai produtos da Lista de Preços WEG (.xlsm) para data/weg-products.json.
 *
 * Mantém apenas: código SAP + descrição SAP + família + sheet de origem.
 * Não armazena preço, peso, dimensões, EAN, NCM, CNPJ, origem CST.
 *
 * Uso:
 *   node scripts/extract-weg-catalog.mjs <caminho/Lista_de_Precos_WEG.xlsm>
 *
 * Estrutura assumida das 4 sheets (CONTROLS, DRIVES, SENSORES E SEGURANÇA, CRITICAL POWER):
 *   col 0 = Código SAP (numérico, 4-12 dígitos)
 *   col 1 = Família
 *   col 2 = Descrição SAP (nome do produto)
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..", "data", "weg-products.json");

const src = process.argv[2];
if (!src) {
  console.error("Uso: node scripts/extract-weg-catalog.mjs <arquivo.xlsm>");
  process.exit(1);
}
if (!fs.existsSync(src)) {
  console.error(`Arquivo não encontrado: ${src}`);
  process.exit(1);
}

const wb = XLSX.readFile(src, { cellFormula: false });

const COL_SAP = 0;
const COL_FAM = 1;
const COL_DESC = 2;

const products = [];
const stats = {};

for (const sheetName of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: "",
  });
  if (rows.length < 2) continue;

  let count = 0;
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sap = String(row[COL_SAP] ?? "").trim();
    const name = String(row[COL_DESC] ?? "").trim().replace(/\s+/g, " ");
    const family = String(row[COL_FAM] ?? "").trim();

    if (!sap || !name || !/^\d{4,12}$/.test(sap)) {
      skipped++;
      continue;
    }
    products.push({
      sap_code: sap,
      name,
      family: family || null,
      brand: "WEG",
      sheet: sheetName,
    });
    count++;
  }
  stats[sheetName] = { count, skipped };
}

const seen = new Set();
const unique = [];
for (const p of products) {
  if (seen.has(p.sap_code)) continue;
  seen.add(p.sap_code);
  unique.push(p);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(unique));

console.log("Extração concluída.");
console.log(`  Por sheet: ${JSON.stringify(stats)}`);
console.log(`  Total bruto: ${products.length}`);
console.log(`  Únicos por sap_code: ${unique.length}`);
console.log(`  Salvo em: ${OUT}`);
