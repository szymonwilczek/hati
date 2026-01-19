// utils.js - Shared helpers
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
