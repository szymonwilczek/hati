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
    this._removeHighlightActor();

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

    // State for Physics
    this._currentX = 0;
    this._currentY = 0;
    this._velocityX = 0;
    this._velocityY = 0;
    this._tickId = 0;

    // Physics Constants (Initialized from Settings)
    this._k = 0.12;
    this._d = 0.65;
    this._updatePhysicsConstants(); // Load actual values

    this._squishDist = 0; // Will be calculated based on size

    // Initial Style
    this._refreshStyle();

    // Add Container to UI Group
    Main.uiGroup.add_child(this._containerActor);

    // Start Physics Loop using GLib Timeout (Fallback for Clutter tick issues)
    // Runs at ~60 FPS (16ms)
    this._tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
      this._tick();
      return GLib.SOURCE_CONTINUE;
    });

    console.log("[Hati] Highlight actor created (Container + CSS + Physics Mode)");
  }

  _updatePhysicsConstants() {
    if (!this._settings) return;
    this._k = this._settings.get_double("inertia-stiffness");
    this._d = this._settings.get_double("inertia-smoothness");
    this._inertiaEnabled = this._settings.get_boolean("inertia-enabled");
    // Safety Clamp
    this._d = Math.max(0.01, Math.min(0.99, this._d));
  }

  _removeHighlightActor() {
    if (this._containerActor) {
      if (this._trackingId) {
        this._containerActor.remove_effect(this._trackingId);
        this._trackingId = null;
      }

      if (this._tickId) {
        GLib.source_remove(this._tickId);
        this._tickId = 0;
      }

      Main.uiGroup.remove_child(this._containerActor);
      this._containerActor.destroy();
      this._containerActor = null;
      this._highlightActor = null;
    }
  }

  _startCursorTracking() {
    // Deprecated: Physics loop starts on creation
  }

  _stopCursorTracking() {
    // Deprecated: Physics loop stops on destruction
  }

  _tick() {
    if (!this._containerActor || !this._highlightActor) return Clutter.TICK_STOP;

    const [pointerX, pointerY] = global.get_pointer();

    // 1. Spring Physics Algorithm (Frame-independent-ish approximation)
    // F = -k*x - d*v

    // Target is where the mouse IS
    // Current is where the actor IS
    // In our system, we want the CENTER of the actor to be at the mouse.

    const containerWidth = this._containerActor.get_width();
    const containerHeight = this._containerActor.get_height();

    // Dist from Mouse to Center of Actor
    // We track total position of Top-Left corner for set_position
    // But physics operates on "Center Point".

    // Let's track the CENTER position in physics vars
    // Initialize if zero (first run)
    if (this._currentX === 0 && this._currentY === 0) {
      this._currentX = pointerX;
      this._currentY = pointerY;
    }

    // Physics Update
    if (this._inertiaEnabled) {
      const dx = pointerX - this._currentX;
      const dy = pointerY - this._currentY;

      const ax = dx * this._k;
      const ay = dy * this._k;

      this._velocityX = (this._velocityX + ax) * this._d;
      this._velocityY = (this._velocityY + ay) * this._d;

      this._currentX += this._velocityX;
      this._currentY += this._velocityY;
    } else {
      // Direct follow
      this._currentX = pointerX;
      this._currentY = pointerY;
      this._velocityX = 0;
      this._velocityY = 0;
    }

    // Apply Position (Top-Left)
    this._containerActor.set_position(
      this._currentX - containerWidth / 2,
      this._currentY - containerHeight / 2
    );

    // 2. Squash & Stretch based on Velocity (Optional)
    // Stretch in direction of movement
    const velocity = Math.sqrt(this._velocityX ** 2 + this._velocityY ** 2);
    // Scale factor: 1.0 + (velocity * 0.01)
    // Needs rotation to match velocity vector? Complex for CSS box.
    // Let's stick to Edge Squish first.

    // 3. Edge Squish
    // If center is close to screen edge, squash the INNER actor.
    const monitor = Main.layoutManager.primaryMonitor;
    if (!monitor) return Clutter.TICK_CONTINUE;

    // Distance to edges
    const distLeft = this._currentX - monitor.x;
    const distRight = (monitor.x + monitor.width) - this._currentX;
    const distTop = this._currentY - monitor.y;
    const distBottom = (monitor.y + monitor.height) - this._currentY;

    // Radius of visual part
    const size = this._settings.get_int("size");
    const radius = size / 2;
    const limit = radius + 20; // Start squishing slightly before touch

    let scaleX = 1.0;
    let scaleY = 1.0;

    if (distLeft < limit) scaleX = Math.max(0.4, distLeft / limit);
    if (distRight < limit) scaleX = Math.max(0.4, distRight / limit);
    if (distTop < limit) scaleY = Math.max(0.4, distTop / limit);
    if (distBottom < limit) scaleY = Math.max(0.4, distBottom / limit);

    // Gentle recovery curve
    scaleX = Math.pow(scaleX, 0.5);
    scaleY = Math.pow(scaleY, 0.5);

    // Apply scaling to INNER actor (Visuals only)
    this._highlightActor.set_scale(scaleX, scaleY);

    return Clutter.TICK_CONTINUE;
  }

  // Clean up unused function
  _updateHighlightPosition() { }

  _toggleHighlight() {
    if (this._settings.get_boolean("enabled")) {
      this._createHighlightActor();
    } else {
      this._removeHighlightActor();
    }
  }

  _onSettingsChanged(key) {
    if (key === "enabled") {
      this._toggleHighlight();
      return;
    }

    if (
      key === "inertia-stiffness" ||
      key === "inertia-smoothness" ||
      key === "inertia-enabled"
    ) {
      this._updatePhysicsConstants();
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

    // Reset Pivot Point to Center for Scaling
    this._highlightActor.set_pivot_point(0.5, 0.5);

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
