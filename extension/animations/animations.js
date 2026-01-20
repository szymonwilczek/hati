// animations/animations.js - Click animations
// SPDX-License-Identifier: GPL-3.0-or-later

class ClickAnimation {
  constructor(settings) {
    this._settings = settings;
  }

  /**
   * Calculates animation transforms
   * @param {object} params - { progress, button, size }
   * @returns {object} - { scaleX, scaleY, translateX, glowMultiplier, extraRingProgress }
   */
  calculate(params) {
    return {
      scaleX: 1.0,
      scaleY: 1.0,
      translateX: 0,
      glowMultiplier: 1.0,
      extraRingProgress: 0,
    };
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
    return {
      scaleX: scale,
      scaleY: scale,
      translateX: 0,
      glowMultiplier: 1.0,
      extraRingProgress: 0,
    };
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
    return {
      scaleX,
      scaleY: 1.0,
      translateX,
      glowMultiplier: 1.0,
      extraRingProgress: 0,
    };
  }
}

class PulseAnimation extends ClickAnimation {
  /**
   * Pulse: Scale up then down (heartbeat effect)
   * Progress 0→1 grows, 1→0 shrinks naturally
   */
  calculate(params) {
    const { progress } = params;
    // scale peaks at progress=1, smooth in/out
    const pulseAmount = progress * 0.15;
    const scale = 1.0 + pulseAmount;
    return {
      scaleX: scale,
      scaleY: scale,
      translateX: 0,
      glowMultiplier: 1.0,
      extraRingProgress: 0,
    };
  }
}

class GlowBurstAnimation extends ClickAnimation {
  /**
   * Glow Burst: Intensify glow on click
   * Progress 0→1 intensifies, 1→0 fades naturally
   */
  calculate(params) {
    const { progress } = params;
    // glow peaks at progress=1
    const glowMultiplier = 1.0 + progress * 1.5;
    return {
      scaleX: 1.0,
      scaleY: 1.0,
      translateX: 0,
      glowMultiplier,
      extraRingProgress: 0,
    };
  }
}

class RingExpandAnimation extends ClickAnimation {
  /**
   * Ring Expand: Third ring expands outward and fades
   * extraRingProgress controls the expanding ring
   */
  calculate(params) {
    const { progress } = params;
    return {
      scaleX: 1.0,
      scaleY: 1.0,
      translateX: 0,
      glowMultiplier: 1.0,
      extraRingProgress: progress,
    };
  }
}

/**
 * Factory function to get animation by mode
 * @param {string} mode - Animation mode
 * @param {object} settings - GSettings object
 * @returns {ClickAnimation}
 */
export function getAnimation(mode, settings) {
  switch (mode) {
    case "ripple":
      return new RippleAnimation(settings);
    case "pulse":
      return new PulseAnimation(settings);
    case "glow-burst":
      return new GlowBurstAnimation(settings);
    case "ring-expand":
      return new RingExpandAnimation(settings);
    case "directional":
    default:
      return new DirectionalAnimation(settings);
  }
}

export {
  ClickAnimation,
  RippleAnimation,
  DirectionalAnimation,
  PulseAnimation,
  GlowBurstAnimation,
  RingExpandAnimation,
};
