#!/usr/bin/env node
// Draws the app icons in the Hot Sauce brand colours (#59) and writes them to icons/.
// Usage: node tools/make-icons.js   (needs Google Chrome; set CHROME_PATH if it isn't found)
// Not part of the game: the release check ignores tools/. Commit the PNGs it writes.
const fs = require('node:fs');
const path = require('node:path');
const { launch, REPO } = require('../tests/helpers/browser');

// [file, size, with food dots]. The 512 icon is also the maskable one (manifest.webmanifest).
const ICONS = [['icon-512.png', 512, true], ['icon-192.png', 192, true], ['apple-touch-icon.png', 180, true], ['favicon-64.png', 64, false]];

// Runs in the browser. The curled worm stays inside the maskable safe zone: the centred
// circle of 80% of the width (curl radius + body radius + outline <= 0.40 of the size).
function draw(size, detailed) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const TAU = Math.PI * 2, PINK = '#ff2e88', ORANGE = '#ff9f1c';
  g.fillStyle = '#0b0f1c';
  g.fillRect(0, 0, size, size);
  const glow = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.48);
  glow.addColorStop(0, 'rgba(255, 46, 136, 0.22)');
  glow.addColorStop(1, 'rgba(255, 46, 136, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);
  if (detailed) {
    for (const [x, y, col] of [[0.5, 0.52, ORANGE], [0.36, 0.62, PINK], [0.63, 0.66, '#ffd166'], [0.22, 0.26, '#2de2e6'], [0.8, 0.2, ORANGE]]) {
      const dot = g.createRadialGradient(x * size, y * size, 0, x * size, y * size, size * 0.035);
      dot.addColorStop(0, '#ffffff');
      dot.addColorStop(0.3, col);
      dot.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = dot;
      g.beginPath();
      g.arc(x * size, y * size, size * 0.035, 0, TAU);
      g.fill();
    }
  }
  // A C-shaped curl open at the bottom: tail at lower left, head at lower right.
  const R = size * (detailed ? 0.26 : 0.24), r = size * (detailed ? 0.11 : 0.135), n = 48, P = [];
  for (let i = 0; i < n; i++) {
    const a = 2.3 * Math.PI - 1.6 * Math.PI * (i / (n - 1));
    P.push([size / 2 + Math.cos(a) * R, size / 2 + Math.sin(a) * R]);
  }
  const rgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const mix = (k) => { const a = rgb(PINK), b = rgb(ORANGE); return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(',')})`; };
  const trace = () => { g.beginPath(); g.moveTo(...P[n - 1]); for (let i = n - 2; i >= 0; i--) g.lineTo(...P[i]); };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  g.lineWidth = 2 * r + size * (detailed ? 0.02 : 0.04);
  trace();
  g.stroke();
  g.lineWidth = 2 * r;
  for (let i = n - 2; i >= 0; i--) { // tail to head, pink head fading to an orange tail
    g.strokeStyle = mix(i / (n - 2));
    g.beginPath();
    g.moveTo(...P[i + 1]);
    g.lineTo(...P[i]);
    g.stroke();
  }
  g.save();
  g.translate(-r * 0.22, -r * 0.3);
  g.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  g.lineWidth = r * 0.55;
  trace();
  g.stroke();
  g.restore();
  const [hx, hy] = P[0], ang = Math.atan2(hy - P[1][1], hx - P[1][0]), ex = Math.cos(ang), ey = Math.sin(ang);
  for (const side of [-1, 1]) {
    const cx = hx + ex * r * 0.32 - ey * side * r * 0.46, cy = hy + ey * r * 0.32 + ex * side * r * 0.46;
    g.beginPath();
    g.arc(cx, cy, r * 0.36, 0, TAU);
    g.fillStyle = '#ffffff';
    g.fill();
    g.lineWidth = Math.max(1, r * 0.06);
    g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    g.stroke();
    g.beginPath();
    g.arc(cx + ex * r * 0.14, cy + ey * r * 0.14, r * 0.19, 0, TAU);
    g.fillStyle = '#141414';
    g.fill();
  }
  return c.toDataURL('image/png');
}

(async () => {
  const page = await launch();
  try {
    for (const [file, size, detailed] of ICONS) {
      const url = await page.eval(`(${draw})(${size}, ${detailed})`);
      fs.writeFileSync(path.join(REPO, 'icons', file), Buffer.from(url.split(',')[1], 'base64'));
      console.log(`icons/${file} (${size}x${size})`);
    }
  } finally {
    await page.close();
  }
})().catch((err) => { console.error(err); process.exit(1); });
