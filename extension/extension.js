// extension.js - Hati Cursor Highlighter for GNOME Shell
// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import St from "gi://St";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

export default class HatiExtension extends Extension {
  constructor(metadata) {
    super(metadata);
    this._highlightActor = null;
    this._shaderEffect = null;
    this._updateId = null;
    this._settings = null;
    this._settingsChangedId = null;
  }

  enable() {
    console.log("[Hati] Enabling cursor highlighter...");

    this._settings = this.getSettings("org.hati.Highlighter");

    // watch for settings changes
    this._settingsChangedId = this._settings.connect(
      "changed",
      (settings, key) => {
        this._onSettingsChanged(key);
      },
    );

    // only proceed if enabled
    if (!this._settings.get_boolean("enabled")) {
      console.log("[Hati] Disabled in settings, not creating highlight");
      return;
    }

    this._createHighlightActor();
    this._startCursorTracking();

    console.log("[Hati] Enabled successfully");
  }

  disable() {
    console.log("[Hati] Disabling cursor highlighter...");

    this._stopCursorTracking();
    this._destroyHighlightActor();

    // cleanup settings
    if (this._settings) {
      if (this._settingsChangedId) {
        this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = null;
      }
      this._settings = null;
    }

    console.log("[Hati] Disabled successfully");
  }

  _createHighlightActor() {
    if (this._highlightActor) {
      return; // already created!
    }

    // get settings
    const size = this._settings.get_int("size");
    const color = this._parseColor(this._settings.get_string("color"));
    const opacity = this._settings.get_double("opacity");
    const borderWeight = this._settings.get_int("border-weight");
    const glow = this._settings.get_boolean("glow") ? 1.0 : 0.0;
    const shape = this._getShapeValue(this._settings.get_string("shape"));

    this._highlightActor = new St.Bin({
      style_class: "hati-highlight",
      width: size,
      height: size,
      opacity: Math.floor(opacity * 255),
      reactive: false,
      can_focus: false,
    });

    // force a background color so Clutter paints something
    // DEBUG: Green box with red border
    this._highlightActor.set_style(`
      background-color: rgba(0, 255, 0, 0.5); 
      border: 4px solid red;
      border-radius: 999px;
    `);

    // SHADER DISABLED FOR DEBUGGING
    /*
    // load and apply GLSL shader
    try {
      const shaderPath = this.path + "/shaders/highlight.glsl";
      const shaderSource = Shell.get_file_contents_utf8_sync(shaderPath);

      const shaderEffect = new Clutter.ShaderEffect();

      shaderEffect.set_shader_source(shaderSource);

      // set shader uniforms
      shaderEffect.set_uniform_value("u_r", color.red / 255.0);
      shaderEffect.set_uniform_value("u_g", color.green / 255.0);
      shaderEffect.set_uniform_value("u_b", color.blue / 255.0);
      shaderEffect.set_uniform_value("u_alpha", color.alpha);
      
      shaderEffect.set_uniform_value("u_border_weight", borderWeight);
      shaderEffect.set_uniform_value("u_glow", glow);
      shaderEffect.set_uniform_value("u_shape", shape);
      
      shaderEffect.set_uniform_value("u_res_x", parseFloat(size));
      shaderEffect.set_uniform_value("u_res_y", parseFloat(size));

      this._highlightActor.add_effect(shaderEffect);
      this._shaderEffect = shaderEffect; // store for later updates
      
      console.log("[Hati] Shader applied successfully");
    } catch (e) {
      console.error("[Hati] Failed to load shader:", e);
      // fallback to simple painted actor
      this._highlightActor.set_background_color(
        new Clutter.Color({
          red: color.red,
          green: color.green,
          blue: color.blue,
          alpha: Math.floor(color.alpha * 255),
        }),
      );
    }
    */

    // UI group (above windows, below UI)
    Main.uiGroup.add_child(this._highlightActor);

    console.log("[Hati] Highlight actor created (Debug Mode)");
  }

  _destroyHighlightActor() {
    if (this._highlightActor) {
      Main.uiGroup.remove_child(this._highlightActor);
      this._highlightActor.destroy();
      this._highlightActor = null;
      console.log("[Hati] Highlight actor destroyed");
    }
  }

  _startCursorTracking() {
    if (this._updateId) {
      return; // already tracking!
    }

    // use frame clock for smooth updates
    this._updateId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
      this._updateHighlightPosition();
      return GLib.SOURCE_CONTINUE; // keep running
    });

    console.log("[Hati] Cursor tracking started");
  }

  _stopCursorTracking() {
    if (this._updateId) {
      GLib.source_remove(this._updateId);
      this._updateId = null;
      console.log("[Hati] Cursor tracking stopped");
    }
  }

  _updateHighlightPosition() {
    if (!this._highlightActor) {
      return;
    }

    // get global pointer position
    const [x, y] = global.get_pointer();

    // center the highlight on cursor
    const size = this._settings.get_int("size");
    const centerX = x - size / 2;
    const centerY = y - size / 2;

    // update actor position
    this._highlightActor.set_position(centerX, centerY);
  }

  _onSettingsChanged(key) {
    console.log(`[Hati] Setting changed: ${key}`);

    switch (key) {
      case "enabled":
        if (this._settings.get_boolean("enabled")) {
          // re-enable highlight
          if (!this._highlightActor) {
            this._createHighlightActor();
            this._startCursorTracking();
          }
        } else {
          // disable highlight
          this._stopCursorTracking();
          this._destroyHighlightActor();
        }
        break;

      case "color":
        this._updateShaderColor();
        break;

      case "size":
        this._updateActorSize();
        break;

      case "opacity":
        this._updateActorOpacity();
        break;

      case "border-weight":
        this._updateShaderBorderWeight();
        break;

      case "glow":
        this._updateShaderGlow();
        break;

      case "shape":
        this._updateShaderShape();
        break;
    }
  }

  _updateShaderColor() {
    if (!this._shaderEffect) return;

    const color = this._parseColor(this._settings.get_string("color"));
    this._shaderEffect.set_uniform_value("u_r", color.red / 255.0);
    this._shaderEffect.set_uniform_value("u_g", color.green / 255.0);
    this._shaderEffect.set_uniform_value("u_b", color.blue / 255.0);
    this._shaderEffect.set_uniform_value("u_alpha", color.alpha);
  }

  _updateActorSize() {
    if (!this._highlightActor) return;

    const size = this._settings.get_int("size");
    this._highlightActor.set_size(size, size);

    // update shader resolution uniform
    if (this._shaderEffect) {
      this._shaderEffect.set_uniform_value("u_res_x", parseFloat(size));
      this._shaderEffect.set_uniform_value("u_res_y", parseFloat(size));
    }
  }

  _updateActorOpacity() {
    if (!this._highlightActor) return;

    const opacity = this._settings.get_double("opacity");
    this._highlightActor.set_opacity(Math.floor(opacity * 255));
  }

  _updateShaderBorderWeight() {
    if (!this._shaderEffect) return;

    const borderWeight = this._settings.get_int("border-weight");
    this._shaderEffect.set_uniform_value("u_border_weight", borderWeight);
  }

  _updateShaderGlow() {
    if (!this._shaderEffect) return;

    const glow = this._settings.get_boolean("glow") ? 1.0 : 0.0;
    this._shaderEffect.set_uniform_value("u_glow", glow);
  }

  _updateShaderShape() {
    if (!this._shaderEffect) return;

    const shape = this._getShapeValue(this._settings.get_string("shape"));
    this._shaderEffect.set_uniform_value("u_shape", shape);
  }

  _getShapeValue(shapeString) {
    // convert shape name to numeric value for shader
    switch (shapeString) {
      case "circle":
        return 0.0;
      case "squircle":
        return 1.0;
      case "square":
        return 2.0;
      default:
        return 0.0; // default to circle
    }
  }

  _parseColor(colorString) {
    // parse "rgba(r, g, b, a)" format
    const match = colorString.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
    );

    if (match) {
      return {
        red: parseInt(match[1]),
        green: parseInt(match[2]),
        blue: parseInt(match[3]),
        alpha: match[4] ? parseFloat(match[4]) : 1.0,
      };
    }

    // Default blue
    return { red: 99, green: 162, blue: 255, alpha: 0.7 };
  }
}
