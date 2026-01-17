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
    // CONTAINER STRATEGY:
    // To prevent "trail/smear" artifacts on Wayland, we must ensure the actor's paint volume
    // fully encloses the CSS box-shadow.
    // We create a larger transparent container and place the styled actor inside it.

    // 1. Container Actor (The one we move)
    this._containerActor = new St.Bin({
      style_class: "hati-container",
      reactive: false,
      can_focus: false,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });

    // 2. Inner Highlight Actor (The visible ring/glow)
    this._highlightActor = new St.Bin({
      style_class: "hati-highlight",
      reactive: false,
      can_focus: false,
    });

    this._containerActor.set_child(this._highlightActor);

    // Initial Style
    this._refreshStyle();

    // Add Container to UI Group
    Main.uiGroup.add_child(this._containerActor);

    // Optional: Force OffscreenRedirect on Container IF artifacts persist.
    // For now, the larger size should be enough.
    // this._containerActor.set_offscreen_redirect(Clutter.OffscreenRedirect.ALWAYS);

    console.log("[Hati] Highlight actor created (Container + CSS Mode)");
  }

  _removeHighlightActor() {
    if (this._containerActor) {
      if (this._trackingId) {
        this._containerActor.remove_effect(this._trackingId);
        this._trackingId = null;
      }

      Main.uiGroup.remove_child(this._containerActor);
      this._containerActor.destroy();
      this._containerActor = null;
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
    if (!this._containerActor) return;

    const [x, y] = global.get_pointer();
    // Container is larger, but we want to center the VISUAL part on the cursor.
    // Since Inner is centered in Container, we just center Container on cursor.

    // Effectively: Center of Container == Cursor.
    const containerWidth = this._containerActor.get_width();
    const containerHeight = this._containerActor.get_height();

    const centerX = x - containerWidth / 2;
    const centerY = y - containerHeight / 2;

    this._containerActor.set_position(centerX, centerY);
  }

  _onSettingsChanged(key) {
    if (key === "enabled") {
      this._toggleHighlight();
      return;
    }
    this._refreshStyle();
  }

  _refreshStyle() {
    if (!this._highlightActor || !this._containerActor) return;

    // Fetch Settings
    const size = this._settings.get_int("size");
    const colorStr = this._settings.get_string("color");
    const color = this._parseColor(colorStr);
    const borderWeight = this._settings.get_int("border-weight");
    const opacity = this._settings.get_double("opacity");
    const shapeStr = this._settings.get_string("shape");
    const glow = this._settings.get_boolean("glow");

    // Logic: Shape
    let radius = "0px";
    if (shapeStr === "circle") {
      radius = "50%";
    } else if (shapeStr === "squircle") {
      radius = "25%";
    }

    // Logic: Glow
    let shadow = "none";
    let padding = 0;

    if (glow) {
      // Robust Glow: large blur radius
      shadow = `0 0 20px 5px rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha})`;
      padding = 50; // Extra space for glow
    } else {
      padding = 10; // Basic anti-aliasing margin
    }

    // 1. Style the Inner Actor (Visuals)
    this._highlightActor.set_size(size, size);
    this._highlightActor.set_style(`
       background-color: transparent;
       border: ${borderWeight}px solid rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha});
       border-radius: ${radius};
       box-shadow: ${shadow};
    `);

    // 2. Size the Container (Geometry)
    // Container must be larger than Inner + Shadow
    const totalSize = size + (padding * 2);
    this._containerActor.set_size(totalSize, totalSize);

    // 3. Opacity (applied to container to affect both)
    this._containerActor.set_opacity(Math.floor(opacity * 255));
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
