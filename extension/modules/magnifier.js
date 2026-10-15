// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Szymon Wilczek

import Clutter from "gi://Clutter";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { MagnifierClipEffect } from "../shaders/magnifier-clip-effect.js";
import { SceneCloner } from "./scene-cloner.js";
import { DEBUG, debugLog } from "../debug.js";

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

const CONFIG_KEYS = [
  "magnifier-enabled",
  "magnifier-key",
  "magnifier-zoom",
  "size",
  "border-weight",
  "corner-radius",
  "rotation",
];

function activationMaskFor(key) {
  if (key.includes("Shift")) return Clutter.ModifierType.SHIFT_MASK;
  if (key.includes("Control")) return Clutter.ModifierType.CONTROL_MASK;
  if (key.includes("Alt")) return Clutter.ModifierType.MOD1_MASK;
  if (key.includes("Super"))
    return Clutter.ModifierType.MOD4_MASK | Clutter.ModifierType.SUPER_MASK;
  return Clutter.ModifierType.SHIFT_MASK;
}

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
    this._unredirectDisabled = false;
    this._lastLogTime = null;
    this._config = null;
    this._readConfig();
    this._settingsChangedId = this._settings.connect("changed", (_s, key) => {
      if (CONFIG_KEYS.includes(key)) this._readConfig();
    });
  }

  _readConfig() {
    const key = this._settings.get_string("magnifier-key") || "Shift_L";
    this._config = {
      enabled: this._settings.get_boolean("magnifier-enabled"),
      keySymbol: KEY_MAP[key] || Clutter.KEY_Shift_L,
      activationMask: activationMaskFor(key),
      size: this._settings.get_int("size") || 100,
      zoom: this._settings.get_double("magnifier-zoom") || 2.0,
      borderWeight: this._settings.get_int("border-weight") || 4,
      cornerRadius: this._settings.get_int("corner-radius") || 50,
      rotation: this._settings.get_int("rotation") || 0,
    };
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

    Main.layoutManager.addChrome(this._group);
  }

  /**
   * Destroy magnifier and clean up resources
   */
  destroy() {
    if (this._settingsChangedId) {
      this._settings.disconnect(this._settingsChangedId);
      this._settingsChangedId = null;
    }

    this._cleanupResources();
    this._setUnredirect(true);

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
    return this._config.activationMask;
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

    if (event.get_key_symbol() !== this._config.keySymbol) {
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
    if (!this._config.enabled) {
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
    if (!this._config.enabled) return;

    const isInterruptedExit = this._group.visible && this._group.opacity > 0;
    if (this._active && !isInterruptedExit) {
      this._group.remove_all_transitions();
      this._group.opacity = 255;
      this._group.set_scale(1.0, 1.0);
      this._group.visible = true;
      return;
    }

    debugLog("[Hati] Magnifier ACTIVATED");
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

    // keep unredirect off while it is on screen
    this._setUnredirect(false);

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

    debugLog("[Hati] Magnifier DEACTIVATED");
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
          this._setUnredirect(true);
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

    const { size, zoom, borderWeight, cornerRadius, rotation } = this._config;

    // calculate magnifier size
    const outerHalf = size / 2;
    const innerEdgeOfOuterRing = outerHalf - borderWeight;
    const magnifierDiameter = Math.max(20, innerEdgeOfOuterRing * 2);
    const maxRadiusPx = magnifierDiameter / 2;
    const magnifierRadius = Math.round(maxRadiusPx * (cornerRadius / 50.0));

    // debug logging
    if (
      DEBUG &&
      (!this._lastLogTime || Date.now() - this._lastLogTime > 2000)
    ) {
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

  /**
   * Toggle fullscreen unredirection, keeping disable/enable calls balanced
   * @param {boolean} enabled - Whether unredirect should be allowed
   */
  _setUnredirect(enabled) {
    if (enabled === !this._unredirectDisabled) return;

    if (enabled) global.compositor.enable_unredirect();
    else global.compositor.disable_unredirect();
    this._unredirectDisabled = !enabled;
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
