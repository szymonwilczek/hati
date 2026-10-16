// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Szymon Wilczek

// Spring is integrated in fixed steps of this length, whatever the monitor
// refresh rate, so it behaves the same at 60 Hz, 144 Hz or when frames are
// dropped. These constants were tuned for one step per 60 Hz frame
export const STEP_MS = 1000 / 60;

// longer gaps are not caught up step by step
const MAX_FRAME_MS = 250;

// closer than this (px, px per step) to the target counts as at rest
const REST_EPSILON = 0.01;

export class Physics {
  constructor(settings) {
    this._settings = settings;
    this._currentX = 0;
    this._currentY = 0;
    this._velocityX = 0;
    this._velocityY = 0;
    this._accumulator = 0;
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
   * @param {number} deltaMs - Time since the previous update in ms
   * @returns {Array<number>} - [x, y] position to draw at
   */
  update(targetX, targetY, deltaMs = STEP_MS) {
    // initialize if first run
    if (this._currentX === 0 && this._currentY === 0) {
      this.reset(targetX, targetY);
      return [this._currentX, this._currentY];
    }

    if (!this._inertiaEnabled) {
      this.reset(targetX, targetY);
      return [this._currentX, this._currentY];
    }

    this._accumulator += Math.min(Math.max(deltaMs, 0), MAX_FRAME_MS);
    while (this._accumulator >= STEP_MS) {
      this._step(targetX, targetY);
      this._accumulator -= STEP_MS;
    }

    if (this._isNear(targetX, targetY)) {
      this.reset(targetX, targetY);
      return [this._currentX, this._currentY];
    }

    // between steps, draw that far into the next one, so frames faster
    // than the step still move without adding a step of latency
    const alpha = this._accumulator / STEP_MS;
    const [vx, vy] = this._nextVelocity(targetX, targetY);
    return [this._currentX + vx * alpha, this._currentY + vy * alpha];
  }

  /**
   * Whether the spring has come to rest on the target
   * @param {number} targetX
   * @param {number} targetY
   * @returns {boolean}
   */
  isSettled(targetX, targetY) {
    return (
      this._currentX === targetX &&
      this._currentY === targetY &&
      this._velocityX === 0 &&
      this._velocityY === 0
    );
  }

  _isNear(targetX, targetY) {
    return (
      Math.abs(targetX - this._currentX) < REST_EPSILON &&
      Math.abs(targetY - this._currentY) < REST_EPSILON &&
      Math.abs(this._velocityX) < REST_EPSILON &&
      Math.abs(this._velocityY) < REST_EPSILON
    );
  }

  _nextVelocity(targetX, targetY) {
    const ax = (targetX - this._currentX) * this._k;
    const ay = (targetY - this._currentY) * this._k;
    return [(this._velocityX + ax) * this._d, (this._velocityY + ay) * this._d];
  }

  _step(targetX, targetY) {
    [this._velocityX, this._velocityY] = this._nextVelocity(targetX, targetY);
    this._currentX += this._velocityX;
    this._currentY += this._velocityY;
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
    this._accumulator = 0;
  }

  /**
   * Returns the current position without updating
   * @returns {Array<number>} - [x, y]
   */
  getPosition() {
    return [this._currentX, this._currentY];
  }
}
