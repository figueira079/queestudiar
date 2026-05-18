#!/usr/bin/env node
/**
 * download-images.js — Descarga imágenes de Unsplash por área de estudio
 *
 * REQUISITOS:
 *   - Node.js 18+ (fetch nativo — sin instalar dependencias)
 *   - Una Access Key gratuita de Unsplash:
 *       1. Regístrate en https://unsplash.com/developers
 *       2. Crea una app (modo "Demo" vale, 50 req/hora gratis)
 *       3. Copia tu "Access Key"
 *       4. Añade esta línea al .env del proyecto:
 *            UNSPLASH_ACCESS_KEY=tu_clave_aqui
 *
 * USO:
 *   node download-images.js
 *
 * Las imágenes se guardan en:  public/assets/areas/<area>.jpg
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable }  = require('stream');

// ─── Configuración ──────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(__dirname, 'public', 'assets', 'areas');

// Lee las variables del .env sin dependencias externas
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx < 1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    if (key && val && !process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!ACCESS_KEY) {
  console.error('\n❌  Falta UNSPLASH_ACCESS_KEY en el archivo .env');
  console.error('    Añade la línea:  UNSPLASH_ACCESS_KEY=tu_clave_aqui\n');
  process.exit(1);
}

// ─── Áreas y palabras clave ──────────────────────────────────────────────────
// Las palabras clave en inglés mejoran la relevancia de los resultados.
// Añade o cambia áreas según las familias de tu base de datos.

const AREAS = {
  negocios:     'business school students',
  ingenieria:   'engineering laboratory students',
  salud:        'medical school hospital students',
  informatica:  'computer science programming technology',
  derecho:      'law school library books',
  humanidades:  'humanities philosophy university library',
  arte:         'art design creative studio students',
  ciencias:     'science research laboratory university',
  educacion:    'teaching classroom education university',
  comunicacion: 'journalism media communication students',
  turismo:      'tourism hospitality hotel management',
  default:      'university campus students outdoor',
};

// ─── Funciones ───────────────────────────────────────────────────────────────

async function searchUnsplash(query) {
  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('per_page', '1');
  url.searchParams.set('content_filter', 'high');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  if (!data.results?.length) throw new Error(`Sin resultados para "${query}"`);

  // 'regular' = ≈1080px de ancho, buena calidad sin exceso de peso
  return data.results[0].urls.regular;
}

async function downloadImage(imageUrl, destPath) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Error al descargar: HTTP ${res.status}`);
  const fileStream = fs.createWriteStream(destPath);
  await pipeline(Readable.fromWeb(res.body), fileStream);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const entries = Object.entries(AREAS);
  console.log(`\n📦  Descargando ${entries.length} imágenes → ${OUTPUT_DIR}\n`);

  let ok = 0, ko = 0;
  for (const [area, keyword] of entries) {
    const destPath = path.join(OUTPUT_DIR, `${area}.jpg`);
    process.stdout.write(`  ⏳  ${area.padEnd(14)} "${keyword}" ... `);
    try {
      const imgUrl = await searchUnsplash(keyword);
      await downloadImage(imgUrl, destPath);
      console.log('✅');
      ok++;
    } catch (err) {
      console.log(`❌  ${err.message}`);
      ko++;
    }
    // Respeta el rate-limit de la cuenta Demo (50 req/h)
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n🎉  Completado: ${ok} descargadas, ${ko} errores`);
  console.log(`    Ruta: ${OUTPUT_DIR}\n`);
}

main().catch(err => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
