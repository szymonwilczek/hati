// modules/physics.js - Inertia physics logic
// SPDX-License-Identifier: GPL-3.0-or-later

export class Physics {
  constructor(settings) {
    this._settings = settings;

    // State
    this._currentX = 0;
    this._currentY = 0;
    this._velocityX = 0;
    this._velocityY = 0;

    // Constants
    this._k = 0.12;
    this._d = 0.65;
    this._inertiaEnabled = true;

    this.updateConstants();
  }

  updateConstants() {
    if (!this._settings) return;
    this._k = this._settings.get_double("inertia-stiffness");
    this._d = this._settings.get_double("inertia-smoothness");
    this._inertiaEnabled = this._settings.get_boolean("inertia-enabled");

    // clamp smoothness
    this._d = Math.max(0.01, Math.min(0.99, this._d));
  }

  /**
   * Updates physics state based on target position
   * @param {number} targetX - Target X position (usually pointer X)
   * @param {number} targetY - Target Y position (usually pointer Y)
   * @returns {Array<number>} - [x, y] current position
   */
  update(targetX, targetY) {
    // initialize if first run
    if (this._currentX === 0 && this._currentY === 0) {
      this._currentX = targetX;
      this._currentY = targetY;
      return [this._currentX, this._currentY];
    }

    if (this._inertiaEnabled) {
      const dx = targetX - this._currentX;
      const dy = targetY - this._currentY;
      const ax = dx * this._k;
      const ay = dy * this._k;

      this._velocityX = (this._velocityX + ax) * this._d;
      this._velocityY = (this._velocityY + ay) * this._d;

      this._currentX += this._velocityX;
      this._currentY += this._velocityY;
    } else {
      this._currentX = targetX;
      this._currentY = targetY;
      this._velocityX = 0;
      this._velocityY = 0;
    }

    return [this._currentX, this._currentY];
  }

  /**
   * Resets physics state to a specific position
   * @param {number} x
   * @param {number} y
   */
  reset(x, y) {
    this._currentX = x;
    this._currentY = y;
    this._velocityX = 0;
    this._velocityY = 0;
  }

  /**
   * Returns the current position without updating
   * @returns {Array<number>} - [x, y]
   */
  getPosition() {
    return [this._currentX, this._currentY];
  }
}
