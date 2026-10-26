/**
 * TIMELESS TRENDS - Swatch Colour Parser & Style Generator
 * 
 * Accurately extracts colors and two-tone finishes from watch variant titles.
 * Handles single finishes, compound finishes (e.g. "Rose Gold"), and multi-tone
 * combinations (e.g. "Silver & Golden", "Silver&golden", "Gold/Black").
 */

// Canonical palette for watch industry finishes
const BASE_COLOURS = {
  black: '#171717',
  silver: '#c0c0c0',
  gold: '#d4af37',
  white: '#ffffff',
  blue: '#2458a6',
  green: '#28734b',
  red: '#b32632',
  brown: '#795548',
  pink: '#e6a0b4',
  purple: '#744da9',
  grey: '#808080',
  gray: '#808080',
  navy: '#172b4d',
  beige: '#d9c7a0',
  champagne: '#e8d8b0',
  bronze: '#cd7f32',
  copper: '#b87333',
  orange: '#d35400',
  yellow: '#f39c12',
  charcoal: '#2c2c2c',
  steel: '#c0c0c0',
  titanium: '#707070',
  gunmetal: '#53565a',
};

// Compound multi-word colors mapped to their canonical hex
const COMPOUND_COLOURS = [
  { phrase: 'rose gold', hex: '#b76e79' },
  { phrase: 'rosegold', hex: '#b76e79' },
  { phrase: 'pink gold', hex: '#b76e79' },
  { phrase: 'white gold', hex: '#e8e8e8' },
  { phrase: 'yellow gold', hex: '#d4af37' },
  { phrase: 'midnight blue', hex: '#172b4d' },
  { phrase: 'navy blue', hex: '#172b4d' },
  { phrase: 'deep blue', hex: '#1b3f8b' },
  { phrase: 'royal blue', hex: '#1b3f8b' },
  { phrase: 'sky blue', hex: '#87ceeb' },
  { phrase: 'ice blue', hex: '#a5d2e6' },
  { phrase: 'forest green', hex: '#1b4d3e' },
  { phrase: 'racing green', hex: '#004225' },
  { phrase: 'olive green', hex: '#556b2f' },
  { phrase: 'dark green', hex: '#1b4d3e' },
  { phrase: 'dark brown', hex: '#4a2c11' },
  { phrase: 'chocolate brown', hex: '#3d2314' },
  { phrase: 'light brown', hex: '#c19a6b' },
];

// Single word aliases
const WORD_ALIASES = {
  golden: 'gold',
  noir: 'black',
  obsidian: 'black',
  onyx: 'black',
  stainless: 'steel',
  chrome: 'silver',
  platinum: 'white',
  emerald: 'green',
  ruby: 'red',
  burgundy: 'red',
  maroon: 'red',
  tan: 'brown',
  cream: 'beige',
  khaki: 'beige',
  violet: 'purple',
  indigo: 'navy',
  anthracite: 'grey',
};

/**
 * Extracts a single primary color from an unbroken segment.
 */
function extractSingleColorFromSegment(segment) {
  const text = segment.toLowerCase().trim();
  if (!text) return null;

  // 1. Check compound colors first
  for (const item of COMPOUND_COLOURS) {
    const regex = new RegExp(`(^|[^a-z])${item.phrase}([^a-z]|$)`, 'i');
    if (regex.test(text)) {
      return item.hex;
    }
  }

  // 2. Tokenize words with strict word boundaries
  const words = text.split(/[^a-z0-9]+/i).filter(Boolean);

  for (const word of words) {
    const canonical = WORD_ALIASES[word] || word;
    if (BASE_COLOURS[canonical]) {
      return BASE_COLOURS[canonical];
    }
  }

  return null;
}

/**
 * Parses any watch variant name into an array of distinct color hex strings.
 * Accurately supports two-tone patterns:
 * - "Silver & Golden"
 * - "Silver&golden"
 * - "Golden &silver"
 * - "Black / Rose Gold"
 * - "Gold / Steel"
 * - "Two-Tone"
 *
 * @param {string} name - The variant title (e.g. "Silver & Golden", "Rose Gold", "Textured Black")
 * @returns {string[]} Array of hex colors (1 or more), or empty if unrecognized.
 */
export function parseVariantColors(name = '') {
  if (typeof name !== 'string' || !name.trim()) {
    return [];
  }

  const raw = name.trim();

  // Explicit check for "two tone" / "bicolor" phrases
  if (/\b(two[- ]?tone|bi[- ]?color)\b/i.test(raw)) {
    const withoutPhrase = raw.replace(/\b(two[- ]?tone|bi[- ]?color)\b/gi, '').trim();
    const subColor = extractSingleColorFromSegment(withoutPhrase);
    if (subColor) {
      return subColor === BASE_COLOURS.gold
        ? [BASE_COLOURS.silver, BASE_COLOURS.gold]
        : [subColor, BASE_COLOURS.gold];
    }
    return [BASE_COLOURS.silver, BASE_COLOURS.gold];
  }

  // Split on multi-tone separators: "&", "/", "+", "and", "with", ","
  // Normalizes tight strings like "Silver&golden" by inserting space around delimiters
  const normalizedSeparators = raw
    .replace(/([a-z0-9])([&/+,])([a-z0-9])/gi, '$1 $2 $3')
    .split(/\s*(?:[&/+,]|\band\b|\bwith\b|\s-\s)\s*/i);

  if (normalizedSeparators.length > 1) {
    const colors = [];
    for (const segment of normalizedSeparators) {
      const col = extractSingleColorFromSegment(segment);
      if (col && !colors.includes(col)) {
        colors.push(col);
      }
    }
    if (colors.length > 0) return colors;
  }

  // Single finish segment: return primary color or empty
  const single = extractSingleColorFromSegment(raw);
  return single ? [single] : [];
}

/**
 * Returns a CSS style object with appropriate background (solid or multi-stop linear gradient)
 * and accessible fallback styling for watch swatches.
 *
 * @param {string} name - Variant colour name
 * @returns {{ background?: string, backgroundColor?: string }}
 */
export function getSwatchStyle(name = '') {
  const colors = parseVariantColors(name);

  if (colors.length === 0) {
    // Neutral luxury metallic finish fallback (slate-metallic)
    return {
      backgroundColor: '#6b7280',
    };
  }

  if (colors.length === 1) {
    return {
      backgroundColor: colors[0],
    };
  }

  if (colors.length === 2) {
    // Crisp diagonal two-tone split representing luxury bimetal watches (e.g. Rolesor / Two-Tone)
    return {
      background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[0]} 50%, ${colors[1]} 50%, ${colors[1]} 100%)`,
    };
  }

  // 3 or more colors (tri-tone)
  const step = 100 / colors.length;
  const stops = colors.map((col, idx) => {
    const start = (idx * step).toFixed(1);
    const end = ((idx + 1) * step).toFixed(1);
    return `${col} ${start}%, ${col} ${end}%`;
  });

  return {
    background: `linear-gradient(135deg, ${stops.join(', ')})`,
  };
}
