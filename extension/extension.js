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
    this._containerActor = null;
    this._outerRing = null;
    this._innerRing = null;
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
    if (this._outerRing) {
      return; // already created!
    }

    // ST.DRAWINGAREA with correct Cairo GJS API
    // Container handles physics positioning
    this._containerActor = new St.Widget({
      style_class: "hati-container",
      reactive: false,
      can_focus: false,
      layout_manager: new Clutter.BinLayout(),
    });

    // Drawing area for Cairo
    this._canvas = new St.DrawingArea({
      style_class: "hati-canvas",
      reactive: false,
      can_focus: false,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });

    this._canvas.connect('repaint', (area) => {
      this._drawHighlight(area);
    });

    this._containerActor.add_child(this._canvas);

    // Keep for compatibility
    this._highlightActor = this._canvas;
    this._outerRing = this._canvas;
    this._innerRing = null;

    // State for Physics
    this._currentX = 0;
    this._currentY = 0;
    this._velocityX = 0;
    this._velocityY = 0;
    this._tickId = 0;

    // Physics Constants
    this._k = 0.12;
    this._d = 0.65;
    this._updatePhysicsConstants();

    // Initial Style
    this._refreshStyle();

    // Add to UI
    Main.uiGroup.add_child(this._containerActor);

    // Start Physics
    this._tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
      this._tick();
      return GLib.SOURCE_CONTINUE;
    });

    console.log("[Hati] Highlight actor created (CSS Mode - Reverted)");
  }

  _updatePhysicsConstants() {
    if (!this._settings) return;
    this._k = this._settings.get_double("inertia-stiffness");
    this._d = this._settings.get_double("inertia-smoothness");
    this._inertiaEnabled = this._settings.get_boolean("inertia-enabled");
    this._d = Math.max(0.01, Math.min(0.99, this._d));
  }

  _removeHighlightActor() {
    if (this._containerActor) {
      if (this._tickId) {
        GLib.source_remove(this._tickId);
        this._tickId = 0;
      }

      Main.uiGroup.remove_child(this._containerActor);
      this._containerActor.destroy();
      this._containerActor = null;
      this._outerRing = null;
      this._innerRing = null;
    }
  }

  _startCursorTracking() { }
  _stopCursorTracking() { }

  _tick() {
    if (!this._containerActor || !this._highlightActor) return Clutter.TICK_STOP;

    const [pointerX, pointerY] = global.get_pointer();
    const containerWidth = this._containerActor.get_width();
    const containerHeight = this._containerActor.get_height();

    if (this._currentX === 0 && this._currentY === 0) {
      this._currentX = pointerX;
      this._currentY = pointerY;
    }

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
      this._currentX = pointerX;
      this._currentY = pointerY;
      this._velocityX = 0;
      this._velocityY = 0;
    }

    this._containerActor.set_position(
      this._currentX - containerWidth / 2,
      this._currentY - containerHeight / 2
    );

    // Edge Squish
    const monitor = Main.layoutManager.primaryMonitor;
    if (!monitor) return Clutter.TICK_CONTINUE;

    const distLeft = this._currentX - monitor.x;
    const distRight = (monitor.x + monitor.width) - this._currentX;
    const distTop = this._currentY - monitor.y;
    const distBottom = (monitor.y + monitor.height) - this._currentY;

    const size = this._settings.get_int("size");
    const radius = size / 2;
    const limit = radius + 20;

    let scaleX = 1.0;
    let scaleY = 1.0;

    if (distLeft < limit) scaleX = Math.max(0.4, distLeft / limit);
    if (distRight < limit) scaleX = Math.max(0.4, distRight / limit);
    if (distTop < limit) scaleY = Math.max(0.4, distTop / limit);
    if (distBottom < limit) scaleY = Math.max(0.4, distBottom / limit);

    scaleX = Math.pow(scaleX, 0.5);
    scaleY = Math.pow(scaleY, 0.5);

    // Scale highlight actor
    this._highlightActor.set_scale(scaleX, scaleY);

    return Clutter.TICK_CONTINUE;
  }

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

    const size = this._settings.get_int("size");
    const colorStr = this._settings.get_string("color");
    const color = this._parseColor(colorStr);
    const borderWeight = this._settings.get_int("border-weight");
    const opacity = this._settings.get_double("opacity");
    const cornerRadius = this._settings.get_int("corner-radius");
    const rotation = this._settings.get_int("rotation");

    // Shape
    const maxRadius = size / 2;
    const radiusPx = Math.round(maxRadius * (cornerRadius / 50.0));
    const radius = `${radiusPx}px`;

    // Store settings for draw callback
    this._drawSettings = {
      size: size,
      borderWeight: borderWeight,
      color: color,
      radiusPx: radiusPx,
      opacity: opacity,
      rotation: rotation,
    };

    // Canvas sizing and invalidation
    const padding = 20;
    const totalSize = size + (padding * 2);

    this._containerActor.set_size(totalSize, totalSize);
    this._canvas.set_size(totalSize, totalSize);
    this._canvas.queue_repaint();

    // Don't apply opacity to container - Cairo handles all transparency
    // This prevents double-opacity multiplication
    this._containerActor.set_opacity(255);
  }

  // Cairo drawing callback for St.DrawingArea - DUAL RING VERSION
  _drawHighlight(area) {
    const cr = area.get_context();
    const [width, height] = area.get_surface_size();

    // Clear canvas
    cr.save();
    cr.setOperator(0); // CLEAR
    cr.paint();
    cr.restore();

    if (!this._drawSettings) return;

    const { size, borderWeight, color, radiusPx, rotation } = this._drawSettings;

    const centerX = width / 2;
    const centerY = height / 2;
    const rotationRad = (rotation || 0) * (Math.PI / 180);

    // Apply Transformations (Rotate around center)
    cr.translate(centerX, centerY);
    cr.rotate(rotationRad);

    // Helper function to draw rounded rectangle path (centered at 0,0)
    const drawRoundedRect = (halfW, cornerR) => {
      const x = -halfW;
      const y = -halfW;
      const w = halfW * 2;
      const h = halfW * 2;
      const r = Math.max(0, cornerR);

      cr.newPath();
      if (r > 0) {
        cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
        cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
        cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
        cr.arc(x + r, y + r, r, Math.PI, 3 * Math.PI / 2);
      } else {
        cr.rectangle(x, y, w, h);
      }
      cr.closePath();
    };

    // Calculate ring dimensions
    // Outer: borderWeight px, 100% opaque
    // Inner: borderWeight + 1 px, user's opacity
    // 1px gap for visual separation
    const outerBorderWidth = borderWeight;
    const innerBorderWidth = borderWeight + 1;
    const gap = 1;

    const outerHalf = size / 2;
    // Inner ring starts where outer ring ends plus gap
    const innerHalf = outerHalf - outerBorderWidth - gap - (innerBorderWidth / 2);
    const outerRadius = radiusPx;
    const innerRadius = Math.max(0, radiusPx - outerBorderWidth - gap);

    // 1. DRAW OUTER RING (100% Opaque)
    cr.setSourceRGBA(
      color.red / 255,
      color.green / 255,
      color.blue / 255,
      1.0 // Always 100% opaque
    );
    cr.setLineWidth(outerBorderWidth);
    drawRoundedRect(outerHalf - outerBorderWidth / 2, outerRadius);
    cr.stroke();

    // 2. DRAW INNER RING (User's opacity setting)
    const { opacity } = this._drawSettings;
    cr.setSourceRGBA(
      color.red / 255,
      color.green / 255,
      color.blue / 255,
      opacity // User's opacity from settings slider
    );
    cr.setLineWidth(innerBorderWidth);
    drawRoundedRect(innerHalf, innerRadius);
    cr.stroke();

    // Dispose context when done
    cr.$dispose();
  }

  _getShapeValue(shapeString) {
    switch (shapeString) {
      case "circle": return 0.0;
      case "squircle": return 1.0;
      case "square": return 2.0;
      default: return 0.0;
    }
  }

  _parseColor(colorString) {
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

    return { red: 99, green: 162, blue: 255, alpha: 0.7 };
  }
}
