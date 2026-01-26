// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from "gi://Clutter";

/**
 * Manages auto-hiding of the highlight when cursor is stationary
 */
export class AutoHide {
  constructor(settings, highlightActor, containerActor) {
    this._settings = settings;
    this._highlightActor = highlightActor;
    this._containerActor = containerActor;

    // State
    this._hidden = false;
    this._lastX = 0;
    this._lastY = 0;
    this._stationaryTime = 0;
  }

  /**
   * Check if currently hidden
   */
  isHidden() {
    return this._hidden;
  }

  /**
   * Update auto-hide state (called every tick)
   * @param {number} curX - Current cursor X
   * @param {number} curY - Current cursor Y
   * @param {number} deltaMs - Time since last tick in ms
   */
  update(curX, curY, deltaMs = 16) {
    // always track position, even when hidden (smoother UX :) )
    const threshold = 2; // pixels of movement to consider as 'moving'
    const dx = Math.abs(curX - this._lastX);
    const dy = Math.abs(curY - this._lastY);
    const moved = dx > threshold || dy > threshold;

    // update last known position
    if (moved) {
      this._lastX = curX;
      this._lastY = curY;
    }

    if (!this._settings.get_boolean("auto-hide")) {
      // auto-hide disabled, ensure visible
      if (this._hidden) {
        this._show();
      }
      this._stationaryTime = 0;
      return;
    }

    if (moved) {
      this._stationaryTime = 0;
      if (this._hidden) {
        this._show();
      }
    } else {
      this._stationaryTime += deltaMs;

      const delay = this._settings.get_int("auto-hide-delay");
      if (!this._hidden && this._stationaryTime >= delay) {
        this._hide();
      }
    }
  }

  /**
   * Reset state (call when extension restarts)
   */
  reset() {
    this._hidden = false;
    this._stationaryTime = 0;
    if (this._containerActor) {
      this._containerActor.remove_all_transitions();
      this._containerActor.opacity = 255;
      this._containerActor.set_scale(1.0, 1.0);
    }
  }

  _hide() {
    if (this._hidden || !this._containerActor) return;

    this._hidden = true;
    this._containerActor.remove_all_transitions();
    this._containerActor.set_pivot_point(0.5, 0.5); // pivot to center for proper shrink animation

    this._containerActor.ease({
      opacity: 0,
      scale_x: 0.3,
      scale_y: 0.3,
      duration: 200,
      mode: Clutter.AnimationMode.EASE_IN_QUAD,
    });
  }

  _show() {
    if (!this._hidden || !this._containerActor) return;

    this._hidden = false;
    this._containerActor.remove_all_transitions();
    this._containerActor.set_pivot_point(0.5, 0.5);

    this._containerActor.ease({
      opacity: 255,
      scale_x: 1.0,
      scale_y: 1.0,
      duration: 150,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
    });
  }
}
