// Genera los íconos PNG de la app sin dependencias: `node tools/iconos.mjs`.
// Dibujo: fondo degradado morado→naranjo, sol blanco con un ✓.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([largo, td, crc]);
}
function png(w, hgt, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(hgt, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // RGB 8 bits, sin alfa (iOS lo prefiere)
  const filas = Buffer.alloc((w * 3 + 1) * hgt);
  for (let y = 0; y < hgt; y++) {
    filas[y * (w * 3 + 1)] = 0;
    rgb.copy(filas, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mezcla = (a, b, t) => a + (b - a) * t;
const cobertura = d => Math.max(0, Math.min(1, 0.5 - d)); // antialiasing con distancia firmada
function distSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function dibujar(N) {
  const out = Buffer.alloc(N * N * 3);
  const s = N / 512;
  const c = N / 2;
  const morado = [108, 76, 245];
  const naranjo = [255, 138, 61];
  const blanco = [255, 255, 255];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const t = (x + y) / (2 * N);
      let col = morado.map((v, i) => mezcla(v, naranjo[i], t));
      const px = x + 0.5, py = y + 0.5;
      const r = Math.hypot(px - c, py - c);
      // rayos del sol
      let rayo = 0;
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 * i) / 12;
        const d = distSegmento(px, py, c + Math.cos(a) * 168 * s, c + Math.sin(a) * 168 * s, c + Math.cos(a) * 205 * s, c + Math.sin(a) * 205 * s) - 13 * s;
        rayo = Math.max(rayo, cobertura(d));
      }
      const disco = cobertura(r - 140 * s);
      const blancoT = Math.max(rayo * 0.9, disco);
      col = col.map((v, i) => mezcla(v, blanco[i], blancoT));
      // check morado sobre el disco
      const d1 = distSegmento(px, py, c - 62 * s, c + 4 * s, c - 16 * s, c + 52 * s);
      const d2 = distSegmento(px, py, c - 16 * s, c + 52 * s, c + 70 * s, c - 50 * s);
      const check = cobertura(Math.min(d1, d2) - 22 * s);
      col = col.map((v, i) => mezcla(v, morado[i], check));
      out[(y * N + x) * 3] = Math.round(col[0]);
      out[(y * N + x) * 3 + 1] = Math.round(col[1]);
      out[(y * N + x) * 3 + 2] = Math.round(col[2]);
    }
  }
  return png(N, N, out);
}

mkdirSync(join(raiz, 'icons'), { recursive: true });
for (const [nombre, N] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(join(raiz, 'icons', nombre), dibujar(N));
  console.log('ícono', nombre, N);
}
