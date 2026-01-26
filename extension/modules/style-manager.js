// SPDX-License-Identifier: GPL-3.0-or-later

import { parseColor } from "../utils.js";

const ACCENT_COLORS = {
  blue: "rgba(53, 132, 228, 1)",
  teal: "rgba(99, 193, 190, 1)",
  green: "rgba(51, 209, 122, 1)",
  yellow: "rgba(246, 211, 45, 1)",
  orange: "rgba(255, 120, 0, 1)",
  red: "rgba(224, 27, 36, 1)",
  pink: "rgba(213, 97, 157, 1)",
  purple: "rgba(145, 65, 172, 1)",
  slate: "rgba(119, 118, 123, 1)",
  default: "rgba(53, 132, 228, 1)",
};

/**
 * Get color string, respecting system accent override
 * @param {object} settings - Extension settings
 * @param {object} interfaceSettings - GNOME interface settings
 * @returns {string} - Color string (rgba format)
 */
export function getColorString(settings, interfaceSettings) {
  let colorString = settings.get_string("color");

  if (interfaceSettings && settings.get_boolean("use-system-accent")) {
    const accent = interfaceSettings.get_string("accent-color");
    if (ACCENT_COLORS[accent]) {
      colorString = ACCENT_COLORS[accent];
    }
  }

  return colorString;
}

/**
 * Build draw settings object from settings
 * @param {object} params - Parameters
 * @param {object} params.settings - Extension settings
 * @param {object} params.interfaceSettings - GNOME interface settings
 * @param {object} params.glow - Glow module instance
 * @returns {object} - Draw settings object
 */
export function buildDrawSettings(params) {
  const { settings, interfaceSettings, glow } = params;

  const size = settings.get_int("size");
  const colorString = getColorString(settings, interfaceSettings);
  const color = parseColor(colorString);

  const borderWeight = settings.get_int("border-weight");
  const gap = settings.get_double("gap");
  const opacity = settings.get_double("opacity");
  const cornerRadius = settings.get_int("corner-radius");
  const rotation = settings.get_int("rotation");

  const glowEnabled = glow ? glow.isEnabled() : false;
  const glowRadius = glow ? glow.getRadius() : 0;
  const glowSpread = glow ? glow.getSpread() : 0;

  const clickAnimations = settings.get_boolean("click-animations");
  const clickAnimationMode = settings.get_string("click-animation-mode");

  const maxRadius = size / 2;
  const radiusPx = Math.round(maxRadius * (cornerRadius / 50.0));

  return {
    size,
    borderWeight,
    gap,
    color,
    radiusPx,
    opacity,
    rotation,
    glow: glowEnabled,
    glowRadius,
    glowSpread,
    clickAnimations,
    clickAnimationMode,
    dashedBorder: settings.get_boolean("dashed-border"),
    dashGapSize: settings.get_double("dash-gap-size"),
    useSystemAccent: settings.get_boolean("use-system-accent"),
    leftClickColor: parseColor(settings.get_string("left-click-color")),
    rightClickColor: parseColor(settings.get_string("right-click-color")),
  };
}

/**
 * Calculate canvas size based on highlight size and glow padding
 * @param {number} size - Highlight size
 * @param {object} glow - Glow module instance
 * @returns {number} - Total canvas size
 */
export function calculateCanvasSize(size, glow) {
  const padding = glow ? glow.calculatePadding() : 20;
  return size + padding * 2;
}
