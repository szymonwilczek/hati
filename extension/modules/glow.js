// SPDX-License-Identifier: GPL-3.0-or-later

export class Glow {
  constructor(settings) {
    this._settings = settings;
    this._enabled = false;
    this._radius = 10;
    this._spread = 5;
    this.updateConstants();
  }

  updateConstants() {
    if (!this._settings) return;
    this._enabled = this._settings.get_boolean("glow");
    this._radius = this._settings.get_int("glow-radius");
    this._spread = this._settings.get_int("glow-spread");
  }

  isEnabled() {
    return this._enabled && this._radius > 0;
  }

  getRadius() {
    return this._radius;
  }

  getSpread() {
    return this._spread;
  }

  /**
   * Calculates padding needed for glow effect
   * @returns {number} - padding in pixels
   */
  calculatePadding() {
    if (this._enabled) {
      return this._radius + this._spread + 20;
    }
    return 20;
  }

  /**
   * Draws the glow effect on Cairo context
   * @param {Cairo.Context} cr - Cairo context
   * @param {object} params - Drawing parameters
   * @param {function} drawRoundedRect - Helper function to draw rounded rect
   */
  draw(cr, params, drawRoundedRect) {
    if (!this._enabled || this._radius <= 0) return;

    const {
      outerHalf,
      outerRadius,
      outerBorderWidth,
      drawColor,
      width,
      height,
      glowMultiplier = 1.0,
    } = params;

    cr.save();

    cr.rectangle(-width, -height, width * 2, height * 2); // universe
    drawRoundedRect(outerHalf - outerBorderWidth, outerRadius); // inner edge of outer ring

    // apply glowMultiplier for glow-burst animation
    const effectiveAlpha = Math.min(
      1.0,
      (drawColor.a * 0.5 * glowMultiplier) / 10,
    );
    cr.setSourceRGBA(drawColor.r, drawColor.g, drawColor.b, effectiveAlpha);

    // with multiple strokes
    const steps = 10;
    const effectiveRadius = this._radius * glowMultiplier;
    const effectiveSpread = this._spread * glowMultiplier;

    for (let i = 0; i < steps; i++) {
      const spread = effectiveSpread + effectiveRadius * (i / steps);
      cr.setLineWidth(outerBorderWidth + spread);
      drawRoundedRect(outerHalf - outerBorderWidth / 2, outerRadius);
      cr.stroke();
    }

    // clip inner region (cleanup)
    cr.setOperator(0); // CLEAR
    cr.setSourceRGBA(0, 0, 0, 1);
    cr.setLineWidth(1);
    drawRoundedRect(
      outerHalf - outerBorderWidth,
      Math.max(0, outerRadius - outerBorderWidth),
    );
    cr.fill(); // eats the inner bleed
    cr.restore();
  }
}
