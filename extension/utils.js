// utils.js - Shared helpers
// SPDX-License-Identifier: GPL-3.0-or-later

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
