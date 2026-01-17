// extension.js - Hati Cursor Highlighter for GNOME Shell
// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import St from "gi://St";
import Cairo from "gi://cairo";

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
    // NUCLEAR OPTION: Pure CSS Actor. No Shaders. No Redirects.
    // We strictly need to verify that the actor can be seen on screen.
    this._highlightActor = new St.Bin({
      style_class: "hati-highlight",
      width: size,
      height: size,
      opacity: Math.floor(opacity * 255),
      reactive: false,
      can_focus: false,
    });

    this._highlightActor.set_style(`
      background-color: red;
      border: 2px solid white;
      border-radius: 999px;
    `);

    // No Effects. No Redirects. Just a red box.
    // This MUST be visible.

    // Load and apply GLSL shader
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

      // Screen Space Uniforms
      shaderEffect.set_uniform_value("u_pos_x", 0.0);
      shaderEffect.set_uniform_value("u_pos_y", 0.0);
      shaderEffect.set_uniform_value("u_root_height", parseFloat(Main.layoutManager.primaryMonitor.height));

      this._highlightActor.add_effect(shaderEffect);
      this._shaderEffect = shaderEffect; // store for later updates

      console.log("[Hati] Shader applied successfully to St.Bin");
    } catch (e) {
      console.error("[Hati] Failed to load shader:", e);
    }

    // Add to the UI group (above windows, below UI)
    Main.uiGroup.add_child(this._highlightActor);

    // Force a redraw to ensure the texture is generated initially
    this._highlightActor.queue_repaint();

    console.log("[Hati] Highlight actor created (CSS + Shader Mode)");
  }

  _removeHighlightActor() {
    if (this._highlightActor) {
      if (this._trackingId) {
        this._highlightActor.remove_effect(this._trackingId);
        this._trackingId = null;
      }

      Main.uiGroup.remove_child(this._highlightActor);
      this._highlightActor.destroy();
      this._highlightActor = null;
      this._shaderEffect = null;
      this._content = null;
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
    if (!this._highlightActor) return;

    const [x, y] = global.get_pointer();
    const size = this._settings.get_int("size");
    const centerX = x - size / 2;
    const centerY = y - size / 2;

    // update actor position
    this._highlightActor.set_position(centerX, centerY);

    // Update Shader Uniforms for FragCoord Calculation
    if (this._shaderEffect) {
      this._shaderEffect.set_uniform_value("u_pos_x", centerX);
      this._shaderEffect.set_uniform_value("u_pos_y", centerY);
      this._shaderEffect.set_uniform_value("u_root_height", parseFloat(Main.layoutManager.primaryMonitor.height));
    }
  }

  _onSettingsChanged(key) {
    if (key === "enabled") {
      this._toggleHighlight();
      return;
    }

    // Update CSS
    this._refreshStyle();

    // Update Shader Uniforms
    if (this._shaderEffect) {
      const color = this._parseColor(this._settings.get_string("color"));
      const borderWeight = this._settings.get_int("border-weight");
      const glow = this._settings.get_boolean("glow") ? 1.0 : 0.0;
      const shape = this._getShapeValue(this._settings.get_string("shape"));
      const size = this._settings.get_int("size");

      this._shaderEffect.set_uniform_value("u_r", color.red / 255.0);
      this._shaderEffect.set_uniform_value("u_g", color.green / 255.0);
      this._shaderEffect.set_uniform_value("u_b", color.blue / 255.0);
      this._shaderEffect.set_uniform_value("u_alpha", color.alpha);

      this._shaderEffect.set_uniform_value("u_border_weight", borderWeight);
      this._shaderEffect.set_uniform_value("u_glow", glow);
      this._shaderEffect.set_uniform_value("u_shape", shape);

      if (key === "size") {
        this._shaderEffect.set_uniform_value("u_res_x", parseFloat(size));
        this._shaderEffect.set_uniform_value("u_res_y", parseFloat(size));
      }
    }
  }

  _refreshStyle() {
    if (!this._highlightActor) return;

    // Simple CSS refresh
    const size = this._settings.get_int("size");
    const color = this._parseColor(this._settings.get_string("color"));
    const borderWeight = this._settings.get_int("border-weight");
    const opacity = this._settings.get_double("opacity");

    this._highlightActor.set_size(size, size);
    // Keep the red box for safety, but maybe match user color?
    // Actually, stick to RED for now. If Shader works, RED is gone.
    this._highlightActor.set_style(`
       background-color: red; 
       border: 2px solid white;
       border-radius: 999px;
    `);

    this._highlightActor.set_opacity(Math.floor(opacity * 255));
    this._highlightActor.queue_repaint();
  }

  _updateActorOpacity() {
    // Managed by refreshStyle
  }

  _updateActorSize() {
    // Managed by refreshStyle
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
