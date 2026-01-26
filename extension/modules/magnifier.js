// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from "gi://Clutter";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { MagnifierClipEffect } from "../shaders/magnifier-clip-effect.js";
import { SceneCloner } from "./scene-cloner.js";

// key symbol mapping
const KEY_MAP = {
  Shift_L: Clutter.KEY_Shift_L,
  Shift_R: Clutter.KEY_Shift_R,
  Control_L: Clutter.KEY_Control_L,
  Control_R: Clutter.KEY_Control_R,
  Alt_L: Clutter.KEY_Alt_L,
  Alt_R: Clutter.KEY_Alt_R,
  Super_L: Clutter.KEY_Super_L,
  Super_R: Clutter.KEY_Super_R,
};

export class Magnifier {
  constructor(settings, physics) {
    this._settings = settings;
    this._physics = physics;
    this._group = null;
    this._contentGroup = null;
    this._clipEffect = null;
    this._sceneCloner = null;
    this._active = false;
    this._keyPressed = false;
    this._lastLogTime = null;
  }

  /**
   * Initialize magnifier UI elements
   */
  init() {
    this._group = new St.Widget({
      style: "background-color: transparent;",
      visible: false,
      width: 300,
      height: 300,
      clip_to_allocation: true,
      offscreen_redirect: Clutter.OffscreenRedirect.ALWAYS,
    });

    this._contentGroup = new St.Widget({
      width: 300,
      height: 300,
    });
    this._group.add_child(this._contentGroup);

    Main.layoutManager.addChrome(this._group, {
      trackFullscreen: true,
    });
  }

  /**
   * Destroy magnifier and clean up resources
   */
  destroy() {
    this._cleanupResources();

    if (this._group) {
      Main.layoutManager.removeChrome(this._group);
      this._group.destroy();
      this._group = null;
    }

    this._contentGroup = null;
  }

  /**
   * Get the magnifier group actor
   */
  getGroup() {
    return this._group;
  }

  /**
   * Check if magnifier is active
   */
  isActive() {
    return this._active;
  }

  /**
   * Get activation mask based on settings
   */
  getActivationMask() {
    const key = this._settings.get_string("magnifier-key") || "Shift_L";
    if (key.includes("Shift")) return Clutter.ModifierType.SHIFT_MASK;
    if (key.includes("Control")) return Clutter.ModifierType.CONTROL_MASK;
    if (key.includes("Alt")) return Clutter.ModifierType.MOD1_MASK;
    if (key.includes("Super")) return Clutter.ModifierType.SUPER_MASK;
    return Clutter.ModifierType.SHIFT_MASK;
  }

  /**
   * Handle key events for activation/deactivation
   * @returns {boolean} - true if event was handled
   */
  handleKeyEvent(event) {
    const type = event.type();
    if (
      type !== Clutter.EventType.KEY_PRESS &&
      type !== Clutter.EventType.KEY_RELEASE
    ) {
      return false;
    }

    const activationKey =
      this._settings.get_string("magnifier-key") || "Shift_L";
    const keyName = event.get_key_symbol();
    const targetKey = KEY_MAP[activationKey] || Clutter.KEY_Shift_L;

    if (keyName !== targetKey) {
      return false;
    }

    if (type === Clutter.EventType.KEY_PRESS && !this._keyPressed) {
      this._keyPressed = true;
      this.activate();
      return true;
    } else if (type === Clutter.EventType.KEY_RELEASE && this._keyPressed) {
      this._keyPressed = false;
      this.deactivate();
      return true;
    }

    return false;
  }

  /**
   * Check activation state via polling
   * @param {number} mask - Current modifier mask
   */
  pollActivation(mask) {
    if (!this._settings.get_boolean("magnifier-enabled")) {
      if (this._active) {
        this.deactivate();
      }
      return;
    }

    const activationMask = this.getActivationMask();
    const isPressed = (mask & activationMask) !== 0;

    if (isPressed && !this._active) {
      this.activate();
    } else if (!isPressed && this._active) {
      this.deactivate();
    }
  }

  /**
   * Activate magnifier with spring animation
   */
  activate() {
    if (!this._group) return;
    if (!this._settings.get_boolean("magnifier-enabled")) return;

    const isInterruptedExit = this._group.visible && this._group.opacity > 0;
    if (this._active && !isInterruptedExit) {
      this._group.remove_all_transitions();
      this._group.opacity = 255;
      this._group.set_scale(1.0, 1.0);
      this._group.visible = true;
      return;
    }

    console.log("[Hati] Magnifier ACTIVATED");
    this._active = true;

    this._group.remove_all_transitions();

    if (!isInterruptedExit) {
      this._group.opacity = 0;
      this._group.set_scale(0.5, 0.5);

      const [pointerX, pointerY] = global.get_pointer();
      this._physics.reset(pointerX, pointerY);
    }

    // create scene cloner and init clones
    if (!this._sceneCloner) {
      this._sceneCloner = new SceneCloner(this._contentGroup);
    }
    this._sceneCloner.init();

    // create clip effect
    if (!this._clipEffect) {
      this._clipEffect = new MagnifierClipEffect();
      this._group.add_effect(this._clipEffect);
    }

    // show with animation
    this._group.visible = true;
    this._group.ease({
      opacity: 255,
      scale_x: 1.0,
      scale_y: 1.0,
      duration: 250,
      mode: Clutter.AnimationMode.EASE_OUT_EXPO,
    });
  }

  /**
   * Deactivate magnifier with animation
   */
  deactivate() {
    if (!this._active || !this._group) return;

    console.log("[Hati] Magnifier DEACTIVATED");
    this._active = false;

    this._group.remove_all_transitions();
    this._group.ease({
      opacity: 0,
      scale_x: 0.8,
      scale_y: 0.8,
      duration: 150,
      mode: Clutter.AnimationMode.EASE_IN_QUART,
      onComplete: () => {
        if (!this._active) {
          this._group.visible = false;
          this._cleanupResources();
        }
      },
    });
  }

  /**
   * Update magnifier position and content (called each tick)
   * @param {number} curX - Current smoothed X position
   * @param {number} curY - Current smoothed Y position
   */
  update(curX, curY) {
    if (!this._group || !this._active) return;

    const size = this._settings.get_int("size") || 100;
    const zoom = this._settings.get_double("magnifier-zoom") || 2.0;
    const borderWeight = this._settings.get_int("border-weight") || 4;
    const cornerRadius = this._settings.get_int("corner-radius") || 50;
    const rotation = this._settings.get_int("rotation") || 0;

    // calculate magnifier size
    const outerHalf = size / 2;
    const innerEdgeOfOuterRing = outerHalf - borderWeight;
    const magnifierDiameter = Math.max(20, innerEdgeOfOuterRing * 2);
    const maxRadiusPx = magnifierDiameter / 2;
    const magnifierRadius = Math.round(maxRadiusPx * (cornerRadius / 50.0));

    // debug logging
    if (!this._lastLogTime || Date.now() - this._lastLogTime > 2000) {
      console.log(
        `[Hati Magnifier] size=${size}, diameter=${magnifierDiameter}`,
      );
      this._lastLogTime = Date.now();
    }

    // update sizes
    this._group.set_size(magnifierDiameter, magnifierDiameter);

    if (this._clipEffect) {
      this._clipEffect.updateUniforms(
        magnifierDiameter,
        magnifierDiameter,
        magnifierRadius,
      );
    }

    // rotation
    this._group.set_pivot_point(0.5, 0.5);
    this._group.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, rotation);

    this._contentGroup.set_size(magnifierDiameter, magnifierDiameter);
    this._contentGroup.set_pivot_point(0.5, 0.5);
    this._contentGroup.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, -rotation);

    // position
    this._group.set_position(
      curX - magnifierDiameter / 2,
      curY - magnifierDiameter / 2,
    );

    // update scene clones
    if (this._sceneCloner) {
      this._sceneCloner.update(curX, curY, zoom, magnifierDiameter);
    }
  }

  _cleanupResources() {
    if (this._sceneCloner) {
      this._sceneCloner.destroy();
      this._sceneCloner = null;
    }

    if (this._clipEffect && this._group) {
      this._group.remove_effect(this._clipEffect);
      this._clipEffect = null;
    }
  }
}
