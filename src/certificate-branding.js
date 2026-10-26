'use strict';

const fs = require('fs');
const sharp = require('sharp');

/**
 * Render a supplied GEST logo without its opaque off-white rectangle.
 * The original /public/img/logo.png is never rewritten.  We process only
 * logos whose corners are substantially white, so logos with a purposeful
 * dark or coloured background stay untouched.
 * White parts inside the mark are also made transparent, allowing the
 * certificate's faint microtext to continue behind the mark itself.
 */
async function cleanLogoBackground(inputBuffer) {
  const {data, info} = await sharp(inputBuffer)
    .rotate()
    .resize({width: 1600, height: 700, fit: 'inside', withoutEnlargement: true})
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});
  const {width, height, channels} = info;
  if(channels !== 4) throw new Error('Unexpected RGBA logo data');
  const cornerLocations = [0, (width - 1) * 4, (height - 1) * width * 4,
    ((height - 1) * width + width - 1) * 4];
  const paleCorners = cornerLocations.filter(offset =>
    data[offset] >= 242 && data[offset + 1] >= 242 &&
    data[offset + 2] >= 242 && data[offset + 3] >= 240).length;
  if(paleCorners < 3) {
    return sharp(data, {raw:{width,height,channels:4}}).png().toBuffer();
  }
  for (let offset = 0; offset < data.length; offset += 4) {
    const r = data[offset], g = data[offset+1], b = data[offset+2];
    const existingAlpha = data[offset+3];
    // Off-white pixels become transparent; anti-aliased edges feather smoothly.
    const distance = 255 - Math.min(r, g, b);
    const coverage = Math.max(0, Math.min(1, (distance - 7) / 39));
    if (coverage === 0) {
      data[offset+3] = 0;
    } else if (coverage < 1) {
      // Keep the original anti-aliased color; aggressively un-matting JPEG/PNG
      // edge pixels would amplify tiny compression artifacts into cyan halos.
      data[offset+3] = Math.round(existingAlpha * coverage);
    }
  }
  return sharp(data,{raw:{width,height,channels:4}}).png({compressionLevel:9}).toBuffer();
}

async function certificateLogoData(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const processed = await cleanLogoBackground(fs.readFileSync(filePath));
  return 'data:image/png;base64,' + processed.toString('base64');
}

/** Fallback if printed seal PNG assets have not yet been copied by an installer.
 * Embedded SVG retains crisp rings and curved lettering when printed to PDF.
 */
function fallbackSealData(kind) {
  const centre = kind === 'centre';
  const navy = '#0d3158', gold = '#c9a24b', outer = centre ? navy : gold;
  const description = centre ? 'OFFICIAL TEST CENTRE' : 'GLOBAL ENGLISH SKILLS TEST';
  const inside = centre ? 'TEST CENTRE' : 'VERIFIED';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs><path id="roundpath" d="M 200,200 m -157,0 a 157,157 0 1,1 314,0 a 157,157 0 1,1 -314,0"/></defs>
    <circle cx="200" cy="200" r="196" fill="#ffffff" stroke="${outer}" stroke-width="9"/>
    <circle cx="200" cy="200" r="175" fill="none" stroke="${gold}" stroke-width="3"/>
    <circle cx="200" cy="200" r="118" fill="none" stroke="${navy}" stroke-width="3"/>
    <text fill="${navy}" font-family="Arial,sans-serif" font-size="21" font-weight="bold" letter-spacing="1.6">
      <textPath href="#roundpath" startOffset="0%">GEST · ${description} · GEST · ${description} · </textPath>
    </text>
    <text x="200" y="193" font-family="Arial,sans-serif" text-anchor="middle" font-size="77" font-weight="900" fill="${navy}">GEST</text>
    <path d="M111 206 H289" stroke="${gold}" stroke-width="6"/>
    <text x="200" y="246" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="${outer}">${inside}</text>
    <text x="200" y="281" text-anchor="middle" font-size="20" fill="${gold}">★ ★ ★</text>
  </svg>`;
  return 'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
}

module.exports={cleanLogoBackground,certificateLogoData,fallbackSealData};
