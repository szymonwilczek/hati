// animations/animations.js - Click animations
// SPDX-License-Identifier: GPL-3.0-or-later

class ClickAnimation {
  constructor(settings) {
    this._settings = settings;
  }

  /**
   * Calculates animation transforms
   * @param {object} params - { progress, button, size }
   * @returns {object} - { scaleX, scaleY, translateX }
   */
  calculate(params) {
    return { scaleX: 1.0, scaleY: 1.0, translateX: 0 };
  }
}

class RippleAnimation extends ClickAnimation {
  /**
   * Ripple: Squeeze to center
   * Scale down to 80% at peak
   */
  calculate(params) {
    const { progress } = params;
    const scale = 1.0 - progress * 0.2;
    return { scaleX: scale, scaleY: scale, translateX: 0 };
  }
}

class DirectionalAnimation extends ClickAnimation {
  /**
   * Directional: Squeeze to side
   * Scale width down to 70%, shift to keep anchor
   */
  calculate(params) {
    const { progress, button, size } = params;
    const scaleX = 1.0 - progress * 0.3;
    const shift = ((size * 0.3) / 2) * progress;
    // left button -> squeeze to left (move left)
    // right button -> squeeze to right (move right)
    const translateX = button === "left" ? -shift : shift;
    return { scaleX, scaleY: 1.0, translateX };
  }
}

/**
 * Factory function to get animation by mode
 * @param {string} mode - Animation mode ('ripple' or 'directional')
 * @param {object} settings - GSettings object
 * @returns {ClickAnimation}
 */
export function getAnimation(mode, settings) {
  switch (mode) {
    case "ripple":
      return new RippleAnimation(settings);
    case "directional":
    default:
      return new DirectionalAnimation(settings);
  }
}

export { ClickAnimation, RippleAnimation, DirectionalAnimation };
