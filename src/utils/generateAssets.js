import fs from 'fs';
import path from 'path';

const productsDir = path.resolve('public/images/products');
const collectionsDir = path.resolve('public/images/collections');
const brandDir = path.resolve('public/images/brand');

fs.mkdirSync(productsDir, { recursive: true });
fs.mkdirSync(collectionsDir, { recursive: true });
fs.mkdirSync(brandDir, { recursive: true });

function createWatchSvg({
  dialColor = '#1A1A1A',
  caseColor = '#D4AF37',
  caseHighlight = '#F5E6BE',
  caseShadow = '#8C7335',
  strapColor = '#222222',
  strapTexture = 'metal', // 'metal' or 'leather' or 'mesh'
  hasSubdials = false,
  bezelColor = null,
  handsColor = '#E0C878',
  indicesColor = '#FFFFFF',
  accentColor = '#B89B62',
  title = 'TIMELESS TRENDS'
}) {
  const actualBezel = bezelColor || caseColor;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="100%" height="100%">
  <defs>
    <!-- Background studio glow -->
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#262626" />
      <stop offset="70%" stop-color="#141414" />
      <stop offset="100%" stop-color="#0A0A0A" />
    </radialGradient>

    <!-- Case metallic gradient -->
    <linearGradient id="caseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${caseHighlight}" />
      <stop offset="35%" stop-color="${caseColor}" />
      <stop offset="70%" stop-color="${caseShadow}" />
      <stop offset="100%" stop-color="${caseHighlight}" />
    </linearGradient>

    <!-- Bezel metallic ring -->
    <radialGradient id="bezelGrad" cx="45%" cy="40%" r="60%">
      <stop offset="0%" stop-color="${actualBezel}" />
      <stop offset="75%" stop-color="${caseShadow}" />
      <stop offset="100%" stop-color="#111" />
    </radialGradient>

    <!-- Crystal glass reflection -->
    <linearGradient id="crystalReflection" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25" />
      <stop offset="30%" stop-color="#ffffff" stop-opacity="0.05" />
      <stop offset="70%" stop-color="#ffffff" stop-opacity="0" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.15" />
    </linearGradient>

    <!-- Strap gradient -->
    <linearGradient id="strapGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${strapColor}" stop-opacity="0.8" />
      <stop offset="50%" stop-color="${strapColor}" />
      <stop offset="100%" stop-color="${strapColor}" stop-opacity="0.7" />
    </linearGradient>

    <!-- Shadow filter -->
    <filter id="watchShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="25" stdDeviation="35" flood-color="#000000" flood-opacity="0.85" />
    </filter>
  </defs>

  <!-- Studio backdrop -->
  <rect width="800" height="1000" fill="url(#bgGrad)" />

  <!-- Subtle floor shadow under watch -->
  <ellipse cx="400" cy="850" rx="220" ry="40" fill="#000000" opacity="0.6" filter="blur(20px)" />

  <g filter="url(#watchShadow)">
    <!-- Top Strap -->
    <g id="topStrap">
      <path d="M 310,120 L 490,120 L 475,340 L 325,340 Z" fill="url(#strapGrad)" />
      ${strapTexture === 'metal' ? `
        <!-- Metal links top -->
        <line x1="312" y1="160" x2="488" y2="160" stroke="#000" stroke-opacity="0.4" stroke-width="3" />
        <line x1="315" y1="205" x2="485" y2="205" stroke="#000" stroke-opacity="0.4" stroke-width="3" />
        <line x1="318" y1="250" x2="482" y2="250" stroke="#000" stroke-opacity="0.4" stroke-width="3" />
        <line x1="322" y1="295" x2="478" y2="295" stroke="#000" stroke-opacity="0.4" stroke-width="3" />
        <line x1="400" y1="120" x2="400" y2="340" stroke="#fff" stroke-opacity="0.1" stroke-width="1.5" />
      ` : strapTexture === 'leather' ? `
        <!-- Leather stitch lines -->
        <path d="M 322,130 L 333,330" stroke="#d5b583" stroke-width="2" stroke-dasharray="6,6" opacity="0.7"/>
        <path d="M 478,130 L 467,330" stroke="#d5b583" stroke-width="2" stroke-dasharray="6,6" opacity="0.7"/>
      ` : `
        <!-- Mesh texture lines -->
        <pattern id="meshPattern" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 0,0 L 10,10 M 10,0 L 0,10" stroke="#fff" stroke-opacity="0.12" stroke-width="1" />
        </pattern>
        <rect x="310" y="120" width="180" height="220" fill="url(#meshPattern)" />
      `}
    </g>

    <!-- Bottom Strap -->
    <g id="bottomStrap">
      <path d="M 325,660 L 475,660 L 490,880 L 310,880 Z" fill="url(#strapGrad)" />
      ${strapTexture === 'metal' ? `
        <!-- Metal links bottom -->
        <line x1="322" y1="705" x2="478" y2="705" stroke="#000" stroke-opacity="0.4" stroke-width="3" />
        <line x1="318" y1="750" x2="482" y2="750" stroke="#000" stroke-opacity="0.4" stroke-width="3" />
        <line x1="315" y1="795" x2="485" y2="795" stroke="#000" stroke-opacity="0.4" stroke-width="3" />
        <line x1="312" y1="840" x2="488" y2="840" stroke="#000" stroke-opacity="0.4" stroke-width="3" />
        <line x1="400" y1="660" x2="400" y2="880" stroke="#fff" stroke-opacity="0.1" stroke-width="1.5" />
      ` : strapTexture === 'leather' ? `
        <!-- Leather stitch lines -->
        <path d="M 333,670 L 322,870" stroke="#d5b583" stroke-width="2" stroke-dasharray="6,6" opacity="0.7"/>
        <path d="M 467,670 L 478,870" stroke="#d5b583" stroke-width="2" stroke-dasharray="6,6" opacity="0.7"/>
      ` : `
        <rect x="310" y="660" width="180" height="220" fill="url(#meshPattern)" />
      `}
    </g>

    <!-- Watch Lugs -->
    <path d="M 305,360 L 330,310 L 360,335 Z" fill="${caseHighlight}" />
    <path d="M 495,360 L 470,310 L 440,335 Z" fill="${caseHighlight}" />
    <path d="M 305,640 L 330,690 L 360,665 Z" fill="${caseShadow}" />
    <path d="M 495,640 L 470,690 L 440,665 Z" fill="${caseShadow}" />

    <!-- Crown & Pushers -->
    <rect x="600" y="480" width="22" height="40" rx="4" fill="url(#caseGrad)" stroke="#111" stroke-width="1.5" />
    <line x1="605" y1="485" x2="605" y2="515" stroke="#000" opacity="0.5" />
    <line x1="612" y1="485" x2="612" y2="515" stroke="#000" opacity="0.5" />
    <line x1="618" y1="485" x2="618" y2="515" stroke="#000" opacity="0.5" />

    ${hasSubdials ? `
      <!-- Chrono Pushers at 2 and 4 o'clock -->
      <rect x="585" y="415" width="18" height="28" rx="3" fill="url(#caseGrad)" transform="rotate(25 585 415)" />
      <rect x="575" y="555" width="18" height="28" rx="3" fill="url(#caseGrad)" transform="rotate(-25 575 555)" />
    ` : ''}

    <!-- Main Outer Case -->
    <circle cx="400" cy="500" r="210" fill="url(#caseGrad)" stroke="#1a1a1a" stroke-width="3" />

    <!-- Bezel Ring -->
    <circle cx="400" cy="500" r="190" fill="url(#bezelGrad)" stroke="#333" stroke-width="2" />

    <!-- Inner Dial -->
    <circle cx="400" cy="500" r="172" fill="${dialColor}" />
    
    <!-- Sunburst radial sheen on dial -->
    <radialGradient id="dialSheen" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.12" />
      <stop offset="70%" stop-color="#000" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#000" stop-opacity="0.6" />
    </radialGradient>
    <circle cx="400" cy="500" r="172" fill="url(#dialSheen)" />

    <!-- Minute Track -->
    <circle cx="400" cy="500" r="162" fill="none" stroke="${indicesColor}" stroke-opacity="0.3" stroke-width="1" stroke-dasharray="2,6" />

    <!-- Hour Markers (12, 1, 2, ..., 11) -->
    <g stroke="${indicesColor}" stroke-linecap="round">
      <!-- 12 o'clock double marker -->
      <line x1="395" y1="344" x2="395" y2="370" stroke-width="4.5" stroke="${accentColor}" />
      <line x1="405" y1="344" x2="405" y2="370" stroke-width="4.5" stroke="${accentColor}" />
      <!-- 3 o'clock -->
      <line x1="530" y1="500" x2="556" y2="500" stroke-width="4.5" stroke="${accentColor}" />
      <!-- 6 o'clock -->
      <line x1="400" y1="630" x2="400" y2="656" stroke-width="4.5" stroke="${accentColor}" />
      <!-- 9 o'clock -->
      <line x1="244" y1="500" x2="270" y2="500" stroke-width="4.5" stroke="${accentColor}" />

      <!-- Intermediate markers -->
      <line x1="478" y1="365" x2="467" y2="384" stroke-width="3" opacity="0.8" />
      <line x1="535" y1="422" x2="516" y2="433" stroke-width="3" opacity="0.8" />
      <line x1="535" y1="578" x2="516" y2="567" stroke-width="3" opacity="0.8" />
      <line x1="478" y1="635" x2="467" y2="616" stroke-width="3" opacity="0.8" />
      <line x1="322" y1="635" x2="333" y2="616" stroke-width="3" opacity="0.8" />
      <line x1="265" y1="578" x2="284" y2="567" stroke-width="3" opacity="0.8" />
      <line x1="265" y1="422" x2="284" y2="433" stroke-width="3" opacity="0.8" />
      <line x1="322" y1="365" x2="333" y2="384" stroke-width="3" opacity="0.8" />
    </g>

    ${hasSubdials ? `
      <!-- Subdials -->
      <!-- 3 o'clock 24-hr subdial -->
      <circle cx="475" cy="500" r="38" fill="#141414" stroke="${accentColor}" stroke-width="1.5" opacity="0.9" />
      <circle cx="475" cy="500" r="3" fill="${handsColor}" />
      <line x1="475" y1="500" x2="488" y2="488" stroke="${handsColor}" stroke-width="1.5" />
      
      <!-- 9 o'clock 60-min subdial -->
      <circle cx="325" cy="500" r="38" fill="#141414" stroke="${accentColor}" stroke-width="1.5" opacity="0.9" />
      <circle cx="325" cy="500" r="3" fill="${handsColor}" />
      <line x1="325" y1="500" x2="315" y2="515" stroke="${handsColor}" stroke-width="1.5" />
      
      <!-- 6 o'clock seconds subdial -->
      <circle cx="400" cy="565" r="38" fill="#141414" stroke="${accentColor}" stroke-width="1.5" opacity="0.9" />
      <circle cx="400" cy="565" r="3" fill="${handsColor}" />
      <line x1="400" y1="565" x2="400" y2="540" stroke="${handsColor}" stroke-width="1.5" />
    ` : ''}

    <!-- Brand Typography on Dial -->
    <text x="400" y="${hasSubdials ? '415' : '440'}" text-anchor="middle" fill="${accentColor}" font-family="'Cinzel', 'Playfair Display', serif" font-size="12" letter-spacing="4" font-weight="600">TIMELESS TRENDS</text>
    <text x="400" y="${hasSubdials ? '427' : '453'}" text-anchor="middle" fill="${indicesColor}" opacity="0.6" font-family="'Plus Jakarta Sans', sans-serif" font-size="7.5" letter-spacing="3">CHRONOMETER</text>

    <!-- Date Window at 4:30 if applicable -->
    <rect x="465" y="525" width="24" height="18" rx="2" fill="#fff" stroke="#333" stroke-width="1" />
    <text x="477" y="538" text-anchor="middle" fill="#111" font-family="sans-serif" font-size="11" font-weight="bold">10</text>

    <!-- Watch Hands -->
    <!-- Hour Hand -->
    <polygon points="400,508 394,500 397,420 400,410 403,420 406,500" fill="${handsColor}" stroke="#111" stroke-width="1" />
    <!-- Minute Hand -->
    <polygon points="400,510 395,500 398,355 400,345 402,355 405,500" fill="${handsColor}" stroke="#111" stroke-width="1" transform="rotate(72 400 500)" />
    <!-- Center Cap -->
    <circle cx="400" cy="500" r="7" fill="${accentColor}" stroke="#111" stroke-width="1.5" />
    <!-- Second Hand (Slim needle) -->
    <line x1="400" y1="535" x2="400" y2="340" stroke="#C53030" stroke-width="1.5" transform="rotate(220 400 500)" />
    <circle cx="400" cy="500" r="3" fill="#C53030" />

    <!-- Sapphire crystal curved glare -->
    <path d="M 245,430 C 270,360 360,335 440,345 C 380,360 300,410 270,490 Z" fill="url(#crystalReflection)" opacity="0.6" />
    <path d="M 535,570 C 510,640 420,665 340,655 C 400,640 480,590 510,510 Z" fill="url(#crystalReflection)" opacity="0.4" />
  </g>
</svg>`;
}

// Generate the specific watch product images
const items = [
  // 1. Chronograph
  {
    file: 'chronograph-silver.svg',
    params: { dialColor: '#E8E8E8', caseColor: '#D8DCE0', caseHighlight: '#FFFFFF', caseShadow: '#8C9298', strapColor: '#D8DCE0', strapTexture: 'metal', hasSubdials: true, handsColor: '#1A1A1A', indicesColor: '#222222', accentColor: '#1A1A1A' }
  },
  {
    file: 'chronograph-black.svg',
    params: { dialColor: '#121212', caseColor: '#C0C4C8', caseHighlight: '#ECEEF0', caseShadow: '#6E7278', strapColor: '#A8ACAF', strapTexture: 'metal', hasSubdials: true, handsColor: '#C5A86A', indicesColor: '#FFFFFF', accentColor: '#C5A86A' }
  },
  {
    file: 'chronograph-navy.svg',
    params: { dialColor: '#0E1F38', caseColor: '#D4AF37', caseHighlight: '#FFF0C2', caseShadow: '#8C7320', strapColor: '#142236', strapTexture: 'leather', hasSubdials: true, handsColor: '#E8D288', indicesColor: '#FFFFFF', accentColor: '#D4AF37' }
  },

  // 2. Heritage Classic Leather
  {
    file: 'heritage-brown.svg',
    params: { dialColor: '#F7F5F0', caseColor: '#D4AF37', caseHighlight: '#FFF2C6', caseShadow: '#8C7225', strapColor: '#5C3818', strapTexture: 'leather', hasSubdials: false, handsColor: '#2B2B2B', indicesColor: '#222222', accentColor: '#8C7225' }
  },
  {
    file: 'heritage-black.svg',
    params: { dialColor: '#1C1C1C', caseColor: '#D0D4D8', caseHighlight: '#FFFFFF', caseShadow: '#7C8086', strapColor: '#1A1A1A', strapTexture: 'leather', hasSubdials: false, handsColor: '#D8DCE0', indicesColor: '#EEEEEE', accentColor: '#A0A4A8' }
  },

  // 3. Aurelia Celestial Mesh
  {
    file: 'aurelia-gold.svg',
    params: { dialColor: '#F4ECE1', caseColor: '#D4AF37', caseHighlight: '#FFF8E1', caseShadow: '#997D24', strapColor: '#D4AF37', strapTexture: 'mesh', hasSubdials: false, handsColor: '#997D24', indicesColor: '#997D24', accentColor: '#B89B62' }
  },
  {
    file: 'aurelia-rosegold.svg',
    params: { dialColor: '#FAF0ED', caseColor: '#C87D6E', caseHighlight: '#F8D8CF', caseShadow: '#8B4E42', strapColor: '#C87D6E', strapTexture: 'mesh', hasSubdials: false, handsColor: '#8B4E42', indicesColor: '#8B4E42', accentColor: '#C87D6E' }
  },
  {
    file: 'aurelia-silver.svg',
    params: { dialColor: '#F2F4F7', caseColor: '#D0D4D8', caseHighlight: '#FFFFFF', caseShadow: '#7E8288', strapColor: '#D0D4D8', strapTexture: 'mesh', hasSubdials: false, handsColor: '#4A4E54', indicesColor: '#4A4E54', accentColor: '#6A6E75' }
  },

  // 4. Seaborne Diver
  {
    file: 'diver-blue.svg',
    params: { dialColor: '#0A2540', bezelColor: '#071829', caseColor: '#C8CCD0', caseHighlight: '#FFFFFF', caseShadow: '#787C82', strapColor: '#A8ACB2', strapTexture: 'metal', hasSubdials: false, handsColor: '#FFFFFF', indicesColor: '#FFFFFF', accentColor: '#38BDF8' }
  },
  {
    file: 'diver-green.svg',
    params: { dialColor: '#0E2E1E', bezelColor: '#081D13', caseColor: '#C8CCD0', caseHighlight: '#FFFFFF', caseShadow: '#787C82', strapColor: '#A8ACB2', strapTexture: 'metal', hasSubdials: false, handsColor: '#FFFFFF', indicesColor: '#FFFFFF', accentColor: '#34D399' }
  },
  {
    file: 'diver-black.svg',
    params: { dialColor: '#111111', bezelColor: '#080808', caseColor: '#C8CCD0', caseHighlight: '#FFFFFF', caseShadow: '#787C82', strapColor: '#A8ACB2', strapTexture: 'metal', hasSubdials: false, handsColor: '#FFFFFF', indicesColor: '#FFFFFF', accentColor: '#E2E8F0' }
  },

  // 5. Slim Dress
  {
    file: 'slim-black.svg',
    params: { dialColor: '#141414', caseColor: '#D0D4D8', caseHighlight: '#FFFFFF', caseShadow: '#787C82', strapColor: '#1E1E1E', strapTexture: 'leather', hasSubdials: false, handsColor: '#FFFFFF', indicesColor: '#E0E0E0', accentColor: '#AEB2B7' }
  },
  {
    file: 'slim-white.svg',
    params: { dialColor: '#F8F9FA', caseColor: '#D0D4D8', caseHighlight: '#FFFFFF', caseShadow: '#787C82', strapColor: '#282828', strapTexture: 'leather', hasSubdials: false, handsColor: '#1A1A1A', indicesColor: '#222222', accentColor: '#6B6B6B' }
  },

  // 6. Sovereign Skeleton
  {
    file: 'skeleton-gunmetal.svg',
    params: { dialColor: '#222428', caseColor: '#505358', caseHighlight: '#7A7E85', caseShadow: '#2E3033', strapColor: '#42454A', strapTexture: 'metal', hasSubdials: true, handsColor: '#C87D6E', indicesColor: '#E0E0E0', accentColor: '#C87D6E' }
  },
  {
    file: 'skeleton-silver.svg',
    params: { dialColor: '#1E232B', caseColor: '#C8CCD0', caseHighlight: '#FFFFFF', caseShadow: '#787C82', strapColor: '#A8ACB2', strapTexture: 'metal', hasSubdials: true, handsColor: '#2563EB', indicesColor: '#FFFFFF', accentColor: '#3B82F6' }
  },

  // 7. Seraphina Petite
  {
    file: 'seraphina-pearl.svg',
    params: { dialColor: '#FBF8F5', caseColor: '#C87D6E', caseHighlight: '#F8D8CF', caseShadow: '#8B4E42', strapColor: '#C87D6E', strapTexture: 'mesh', hasSubdials: false, handsColor: '#8B4E42', indicesColor: '#C87D6E', accentColor: '#C87D6E' }
  },
  {
    file: 'seraphina-silver.svg',
    params: { dialColor: '#FBF8F5', caseColor: '#D0D4D8', caseHighlight: '#FFFFFF', caseShadow: '#7E8288', strapColor: '#D0D4D8', strapTexture: 'mesh', hasSubdials: false, handsColor: '#4A4E54', indicesColor: '#6A6E75', accentColor: '#8A8E95' }
  },

  // 8. Apex Chrono
  {
    file: 'apex-allblack.svg',
    params: { dialColor: '#101010', caseColor: '#242528', caseHighlight: '#404246', caseShadow: '#0E0F10', strapColor: '#222326', strapTexture: 'metal', hasSubdials: true, handsColor: '#D4AF37', indicesColor: '#FFFFFF', accentColor: '#D4AF37' }
  },
  {
    file: 'apex-goldbezel.svg',
    params: { dialColor: '#121212', bezelColor: '#D4AF37', caseColor: '#242528', caseHighlight: '#404246', caseShadow: '#0E0F10', strapColor: '#222326', strapTexture: 'metal', hasSubdials: true, handsColor: '#D4AF37', indicesColor: '#F5E6BE', accentColor: '#D4AF37' }
  }
];

// Write product images
items.forEach(item => {
  const filePath = path.join(productsDir, item.file);
  fs.writeFileSync(filePath, createWatchSvg(item.params), 'utf8');
});

// Create Collection Cover SVGs
function createCollectionBanner(title, subtitle, bgGrad1, bgGrad2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" width="100%" height="100%">
    <defs>
      <linearGradient id="cGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgGrad1}" />
        <stop offset="100%" stop-color="${bgGrad2}" />
      </linearGradient>
    </defs>
    <rect width="1200" height="600" fill="url(#cGrad)" />
    <!-- Subtle geometric luxury overlay -->
    <circle cx="600" cy="300" r="220" fill="none" stroke="#B89B62" stroke-width="1.5" opacity="0.25" />
    <circle cx="600" cy="300" r="180" fill="none" stroke="#B89B62" stroke-width="1" opacity="0.15" />
    <line x1="200" y1="300" x2="1000" y2="300" stroke="#B89B62" stroke-width="1" opacity="0.2" />
    <text x="600" y="270" text-anchor="middle" fill="#FFFFFF" font-family="'Cinzel', 'Playfair Display', serif" font-size="44" letter-spacing="6" font-weight="600">${title.toUpperCase()}</text>
    <text x="600" y="325" text-anchor="middle" fill="#B89B62" font-family="'Plus Jakarta Sans', sans-serif" font-size="16" letter-spacing="4">${subtitle.toUpperCase()}</text>
    <text x="600" y="380" text-anchor="middle" fill="#AEB2B7" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" letter-spacing="2">TIMELESS TRENDS CURATION</text>
  </svg>`;
}

fs.writeFileSync(path.join(collectionsDir, 'everyday-classics.svg'), createCollectionBanner('Everyday Classics', 'Timeless Precision & Daily Elegance', '#1C1917', '#0C0A09'), 'utf8');
fs.writeFileSync(path.join(collectionsDir, 'trending.svg'), createCollectionBanner('Trending & Modern', 'Contemporary Silhouettes & Bold Statements', '#111827', '#030712'), 'utf8');
fs.writeFileSync(path.join(collectionsDir, 'mens.svg'), createCollectionBanner("Men's Collection", 'Bold Chronographs & Architectural Steel', '#18181B', '#09090B'), 'utf8');
fs.writeFileSync(path.join(collectionsDir, 'womens.svg'), createCollectionBanner("Women's Collection", 'Graceful Mesh, Celestial Dials & Fine Accents', '#261C20', '#120B0E'), 'utf8');

// Create brand mark SVG
const brandSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 150" width="100%" height="100%">
  <text x="300" y="70" text-anchor="middle" fill="#191919" font-family="'Cinzel', 'Playfair Display', serif" font-size="34" letter-spacing="10" font-weight="700">TIMELESS TRENDS</text>
  <line x1="200" y1="88" x2="400" y2="88" stroke="#B89B62" stroke-width="1.5" />
  <text x="300" y="112" text-anchor="middle" fill="#6B6B6B" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" letter-spacing="5">HAUTE HORLOGERIE &amp; STYLE</text>
</svg>`;
fs.writeFileSync(path.join(brandDir, 'logo.svg'), brandSvg, 'utf8');

const brandDarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 150" width="100%" height="100%">
  <text x="300" y="70" text-anchor="middle" fill="#F7F5F0" font-family="'Cinzel', 'Playfair Display', serif" font-size="34" letter-spacing="10" font-weight="700">TIMELESS TRENDS</text>
  <line x1="200" y1="88" x2="400" y2="88" stroke="#B89B62" stroke-width="1.5" />
  <text x="300" y="112" text-anchor="middle" fill="#AEB2B7" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" letter-spacing="5">HAUTE HORLOGERIE &amp; STYLE</text>
</svg>`;
fs.writeFileSync(path.join(brandDir, 'logo-dark.svg'), brandDarkSvg, 'utf8');

console.log('All vector assets created successfully!');
