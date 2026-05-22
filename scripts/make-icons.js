// Generates the app icons from the minido logo paths.
// Run: node scripts/make-icons.js
const sharp = require('sharp');
const path = require('path');

const BG = '#312f29';
const FG = '#e8e2d4';

// Logo paths (same shapes as src/components/MinidoLogo.tsx), in a 0..130 x 0..22 viewBox.
const LOGO = `
  <path d="M2 18V4l7 8 7-8v14" stroke="${FG}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <line x1="22" y1="4" x2="22" y2="18" stroke="${FG}" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M28 18V4l8 14V4" stroke="${FG}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <line x1="42" y1="4" x2="42" y2="18" stroke="${FG}" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M48 4h5a7 7 0 0 1 0 14h-5V4z" stroke="${FG}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="73" cy="11" r="7" stroke="${FG}" stroke-width="1.6" fill="none"/>
`;

// Main icon: bg fill + centred logo.
function iconSvg({ size, bg, withBg = true, logoWidthPct = 0.62 }) {
  // Logo's intrinsic viewBox is 80x22 (cut to the actual letters), aspect 80/22 ~ 3.64.
  const logoVW = 80;
  const logoVH = 22;
  const logoW = size * logoWidthPct;
  const logoH = logoW * (logoVH / logoVW);
  const logoX = (size - logoW) / 2;
  const logoY = (size - logoH) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${withBg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}
    <svg x="${logoX}" y="${logoY}" width="${logoW}" height="${logoH}" viewBox="0 0 ${logoVW} ${logoVH}">
      ${LOGO}
    </svg>
  </svg>`;
}

async function render(svg, outFile) {
  await sharp(Buffer.from(svg))
    .png()
    .toFile(outFile);
  console.log('wrote', outFile);
}

(async () => {
  const out = (n) => path.join(__dirname, '..', 'assets', n);

  // icon.png — 1024x1024, full bg + logo
  await render(iconSvg({ size: 1024, bg: BG }), out('icon.png'));

  // adaptive-icon.png — 1024x1024, TRANSPARENT bg (the app.json backgroundColor fills it).
  // Logo lives in the safe centre (~66% of the canvas) so Android's launcher mask never cuts into it.
  await render(iconSvg({ size: 1024, bg: BG, withBg: false, logoWidthPct: 0.46 }), out('adaptive-icon.png'));

  // splash-icon.png — same as main icon, used by the splash screen.
  await render(iconSvg({ size: 1024, bg: BG }), out('splash-icon.png'));

  // favicon.png — 48x48, mini version
  await render(iconSvg({ size: 48, bg: BG, logoWidthPct: 0.78 }), out('favicon.png'));
})().catch((e) => { console.error(e); process.exit(1); });
