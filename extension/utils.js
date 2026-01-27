// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Maps a shape name string to a shader float value
 * @param {string} shapeString - 'circle', 'squircle', 'square'
 * @returns {number} - 0.0, 1.0, or 2.0
 */
export function getShapeValue(shapeString) {
  switch (shapeString) {
    case "circle":
      return 0.0;
    case "squircle":
      return 1.0;
    case "square":
      return 2.0;
    default:
      return 0.0;
  }
}
/**
 * Parses a CSS-like rgba string into a Clutter/Cairo compatible object
 * @param {string} colorString - e.g. "rgba(255, 255, 255, 1.0)"
 * @returns {Object} - { red, green, blue, alpha }
 */
export function parseColor(colorString) {
  const match = colorString.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
  );

  if (match) {
    return {
      red: parseInt(match[1]),
      green: parseInt(match[2]),
      blue: parseInt(match[3]),
      alpha: match[4] ? parseFloat(match[4]) : 1.0,
    };
  }

  return { red: 99, green: 162, blue: 255, alpha: 0.7 };
}

/**
 * Converts HSL color values to RGB object
 * @param {number} h - Hue (0.0 to 360.0)
 * @param {number} s - Saturation (0.0 to 1.0)
 * @param {number} l - Lightness (0.0 to 1.0)
 * @returns {Object} - { red, green, blue, alpha: 1.0 }
 */
export function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  return {
    red: Math.round((r + m) * 255),
    green: Math.round((g + m) * 255),
    blue: Math.round((b + m) * 255),
    alpha: 1.0,
  };
}
