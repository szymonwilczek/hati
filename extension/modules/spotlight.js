// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from "gi://Clutter";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { getShapeValue } from "../utils.js";
import { SpotlightEffect } from "../shaders/spotlight-effect.js";

export class Spotlight {
  constructor(settings) {
    this._settings = settings;
    this._enabled = settings.get_boolean("spotlight-enabled");
    this._key = settings.get_string("spotlight-key");
    this._opacity = settings.get_double("spotlight-opacity");
    this._size = settings.get_int("spotlight-size");
    this._shape = getShapeValue(settings.get_string("shape"));
    this._rotation = settings.get_int("rotation");
    this._cornerRadius = settings.get_int("corner-radius");
    this._active = false;
    this._actor = null;
    this._effect = null;
    this._x = 0;
    this._y = 0;

    this._settings.connect("changed::spotlight-enabled", () => {
      this._enabled = this._settings.get_boolean("spotlight-enabled");
      if (!this._enabled) this.deactivate();
    });
    this._settings.connect("changed::spotlight-key", () => {
      this._key = this._settings.get_string("spotlight-key");
    });
    this._settings.connect("changed::spotlight-opacity", () => {
      this._opacity = this._settings.get_double("spotlight-opacity");
      if (this._active && this._effect) {
        this._updateUniforms();
      }
    });
    this._settings.connect("changed::spotlight-size", () => {
      this._size = this._settings.get_int("spotlight-size");
      if (this._active && this._effect) {
        this._updateUniforms();
      }
    });

    this._settings.connect("changed::shape", () => {
      this._shape = getShapeValue(this._settings.get_string("shape"));
      if (this._active && this._effect) {
        this._updateUniforms();
      }
    });
    this._settings.connect("changed::rotation", () => {
      this._rotation = this._settings.get_int("rotation");
      if (this._active && this._effect) {
        this._updateUniforms();
      }
    });
    this._settings.connect("changed::corner-radius", () => {
      this._cornerRadius = this._settings.get_int("corner-radius");
      if (this._active && this._effect) {
        this._updateUniforms();
      }
    });
  }

  update(x, y) {
    if (!this._enabled) return;

    this._x = x;
    this._y = y;

    if (this._active && this._effect) {
      this._updateUniforms();
    }
  }

  _updateUniforms() {
    if (!this._effect) return;

    const maxRadius = this._size / 2.0;
    const radiusPx = (this._cornerRadius / 50.0) * maxRadius;

    this._effect.updateUniforms({
      x: this._x,
      y: this._y,
      size: this._size,
      opacity: this._opacity,
      shape: this._shape,
      radius: radiusPx,
      rotation: this._rotation,
      width: global.stage.width,
      height: global.stage.height,
    });
  }

  pollActivation(mask) {
    if (!this._enabled) return;

    const keyMap = {
      Shift_L: Clutter.ModifierType.SHIFT_MASK,
      Shift_R: Clutter.ModifierType.SHIFT_MASK,
      Control_L: Clutter.ModifierType.CONTROL_MASK,
      Control_R: Clutter.ModifierType.CONTROL_MASK,
      Alt_L: Clutter.ModifierType.MOD1_MASK,
      Alt_R: Clutter.ModifierType.MOD1_MASK,
      Super_L: Clutter.ModifierType.MOD4_MASK,
      Super_R: Clutter.ModifierType.MOD4_MASK,
    };

    const targetMask = keyMap[this._key];
    const isPressed = (mask & targetMask) !== 0;

    if (isPressed && !this._active) {
      this.activate();
    } else if (!isPressed && this._active) {
      this.deactivate();
    }
  }

  activate() {
    if (this._actor) return;

    this._shape = getShapeValue(this._settings.get_string("shape"));
    this._rotation = this._settings.get_int("rotation");
    this._cornerRadius = this._settings.get_int("corner-radius");

    this._active = true;

    this._actor = new St.Widget({
      style_class: "hati-spotlight-overlay",
      reactive: false,
      can_focus: false,
      x: 0,
      y: 0,
      width: global.stage.width,
      height: global.stage.height,
      opacity: 0,
    });

    this._effect = new SpotlightEffect();
    this._actor.add_effect(this._effect);

    this._updateUniforms();

    global.stage.add_child(this._actor);
    global.stage.set_child_above_sibling(this._actor, null);

    this._actor.ease({
      opacity: 255,
      duration: 250,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
    });
  }

  deactivate() {
    if (!this._actor) return;

    this._active = false;
    const actor = this._actor;
    this._actor = null;
    this._effect = null;

    actor.ease({
      opacity: 0,
      duration: 250,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      onComplete: () => {
        actor.destroy();
      },
    });
  }

  destroy() {
    if (this._actor) {
      this._actor.destroy();
      this._actor = null;
    }
    this._effect = null;
  }
}
