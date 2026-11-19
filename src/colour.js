// Colour helpers so text placed on a client's brand colour stays readable,
// whatever colours the client picks.

function rgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

// WCAG relative luminance.
function luminance(hex) {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Picks near-black or white text, whichever reads better on the background.
function readableOn(bg) {
  return contrast(bg, '#ffffff') >= contrast(bg, '#111111') ? '#ffffff' : '#111111';
}

const isDark = (hex) => readableOn(hex) === '#ffffff';

module.exports = { luminance, contrast, readableOn, isDark };
