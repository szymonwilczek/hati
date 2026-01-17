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
    // CSS-Based Highlight Actor
    // ShaderEffect is unreliable on GNOME 49 (invisibility).
    // We use standard St/CSS properties to achieve the ring/glow effect.
    this._highlightActor = new St.Bin({
      style_class: "hati-highlight",
      width: size,
      height: size,
      opacity: Math.floor(opacity * 255),
      reactive: false,
      can_focus: false,
    });

    // Initial Style
    this._refreshStyle();

    // Add to the UI group (above windows, below UI)
    Main.uiGroup.add_child(this._highlightActor);

    console.log("[Hati] Highlight actor created (Pure CSS Mode)");
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
  }

  _onSettingsChanged(key) {
    if (key === "enabled") {
      this._toggleHighlight();
      return;
    }

    // Update CSS
    this._refreshStyle();
  }

  _refreshStyle() {
    if (!this._highlightActor) return;

    // Fetch Settings
    const size = this._settings.get_int("size");
    const colorStr = this._settings.get_string("color");
    const color = this._parseColor(colorStr);
    const borderWeight = this._settings.get_int("border-weight");
    const opacity = this._settings.get_double("opacity");
    const shapeStr = this._settings.get_string("shape"); // circle, square, squircle
    const glow = this._settings.get_boolean("glow");

    // Map Shape to Border Radius
    let radius = "0px";
    if (shapeStr === "circle") {
      radius = "50%"; // Perfect circle
    } else if (shapeStr === "squircle") {
      radius = "25%"; // Approximate squircle
    } else {
      radius = "0px"; // Square
    }

    // Map Glow to Box Shadow
    // box-shadow: x y blur spread color
    // We use a simplified glow if enabled
    let shadow = "none";
    if (glow) {
      // Use the same color as border but maybe more transparent?
      // Or just the same color.
      shadow = `0 0 10px 2px rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha})`;
    }

    this._highlightActor.set_size(size, size);
    this._highlightActor.set_opacity(Math.floor(opacity * 255));

    // Construct CSS String
    // Note: We use transparent background to see through the ring.
    // Ideally we want the border to define the shape.
    this._highlightActor.set_style(`
       background-color: transparent;
       border: ${borderWeight}px solid rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha});
       border-radius: ${radius};
       box-shadow: ${shadow};
    `);
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
