/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { compileMarker } from './compile-marker.mjs';

// Arte vectorial original determinista, sin fotografías ni licencias de terceros.
let seed = 0x617231;
const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
const colors = ['#163451', '#eb643d', '#ffcb66', '#2c807d', '#f4eee0', '#573c72'];
const shapes = [];
for (let i = 0; i < 190; i++) {
  const x = Math.round(random() * 760 + 20), y = Math.round(random() * 540 + 20);
  const r = Math.round(random() * 20 + 5), color = colors[Math.floor(random() * colors.length)];
  shapes.push(i % 3 ? `<path d="M${x} ${y}l${r} ${r / 2}l${-r / 3} ${r}l${-r} ${-r / 2}Z" fill="${color}" stroke="#182a35" stroke-width="2"/>`
    : `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="#fff5df" stroke-width="3"/>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<rect width="800" height="600" fill="#e6dfce"/>${shapes.join('')}
<path d="M70 445L260 190L388 350L514 98L745 456Z" fill="#173a52" stroke="#ffce69" stroke-width="7"/>
<path d="M260 190L310 266L247 244L209 258Z M514 98L569 187L514 162L474 180Z" fill="#faf2de"/>
<circle cx="635" cy="130" r="51" fill="#ef784c" stroke="#173a52" stroke-width="8"/>
<path d="M100 477Q350 380 701 489" fill="none" stroke="#2b9184" stroke-width="28"/>
<rect x="190" y="473" width="420" height="95" rx="12" fill="#fff7e4"/>
<text x="222" y="532" fill="#173a52" font-family="sans-serif" font-size="48" font-weight="bold">WEBAR / 01</text>
<text x="222" y="554" fill="#173a52" font-family="sans-serif" font-size="14">OPEN VISION · EXPLORE THE WORLD</text></svg>`;
await mkdir('public', { recursive: true });
await writeFile('public/marker.svg', svg);
await sharp(Buffer.from(svg)).png().toFile('public/marker.png');
await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toFile('public/marker.jpg');
await compileMarker('public/marker.png', 'public/target.dat', 0.2);
console.log('Demo: imprimir marker.png con ancho físico de 20 cm para escala métrica.');
