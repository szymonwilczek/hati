// extension.js - Hati Cursor Highlighter for GNOME Shell
// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import St from "gi://St";
import Gio from "gi://Gio";
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
    this._interfaceSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.interface",
    });

    // watch for settings changes
    this._settingsChangedId = this._settings.connect(
      "changed",
      (settings, key) => {
        this._onSettingsChanged(key);
      },
    );

    // watch for system accent changes
    this._interfaceSettingsChangedId = this._interfaceSettings.connect(
      "changed::accent-color",
      () => {
        if (this._settings.get_boolean("use-system-accent")) {
          this._refreshStyle();
        }
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

    if (this._interfaceSettings) {
      if (this._interfaceSettingsChangedId) {
        this._interfaceSettings.disconnect(this._interfaceSettingsChangedId);
        this._interfaceSettingsChangedId = null;
      }
      this._interfaceSettings = null;
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

    this._canvas.connect("repaint", (area) => {
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

  _startCursorTracking() {}
  _stopCursorTracking() {}

  _tick() {
    if (!this._containerActor || !this._highlightActor)
      return Clutter.TICK_STOP;

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

    // --- Click Animation Logic ---
    if (!this._clickState) {
      this._clickState = {
        active: false,
        button: null, // 'left' / 'right'
        progress: 0.0, // 0.0 to 1.0
        closing: false, // true if releasing button
      };
    }

    // detect button state from mask
    // global.get_pointer returns [x, y, mask]
    // mask & Clutter.ModifierType.BUTTON1_MASK (Left)
    // mask & Clutter.ModifierType.BUTTON3_MASK (Right) usually (in my system BUTTON3 is middle - scroll - click)
    const [, , mask] = global.get_pointer();
    const leftPressed = (mask & Clutter.ModifierType.BUTTON1_MASK) !== 0;
    const rightPressed = (mask & Clutter.ModifierType.BUTTON3_MASK) !== 0;

    const anyPressed = leftPressed || rightPressed;
    const pressedButton = leftPressed ? "left" : rightPressed ? "right" : null;

    // react to state changes
    if (anyPressed && !this._clickState.active) {
      // START CLICK
      this._clickState.active = true;
      this._clickState.button = pressedButton;
      this._clickState.progress = 0.0;
      this._clickState.closing = false;
      this._canvas.queue_repaint();
    } else if (
      !anyPressed &&
      this._clickState.active &&
      !this._clickState.closing
    ) {
      // RELEASE CLICK
      this._clickState.closing = true;
    }

    // animate progress
    if (this._clickState.active) {
      const speed = 0.15; // approx 60fps -> 0.15 * 60 = 9.0/sec?? too fast. 0.15 per tick(16ms) -> ~6 frames to full - fast

      if (!this._clickState.closing) {
        // pressing down: animate to 1.0
        if (this._clickState.progress < 1.0) {
          this._clickState.progress = Math.min(
            1.0,
            this._clickState.progress + speed,
          );
          this._canvas.queue_repaint();
        }
      } else {
        // released: animate back to 0.0
        if (this._clickState.progress > 0.0) {
          this._clickState.progress = Math.max(
            0.0,
            this._clickState.progress - speed,
          );
          this._canvas.queue_repaint();
        } else {
          // finished closing
          this._clickState.active = false;
          this._clickState.button = null;
        }
      }
    }

    this._containerActor.set_position(
      this._currentX - containerWidth / 2,
      this._currentY - containerHeight / 2,
    );

    // Edge Squish
    const monitor = Main.layoutManager.primaryMonitor;
    if (!monitor) return Clutter.TICK_CONTINUE;

    const distLeft = this._currentX - monitor.x;
    const distRight = monitor.x + monitor.width - this._currentX;
    const distTop = this._currentY - monitor.y;
    const distBottom = monitor.y + monitor.height - this._currentY;

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

  _updateHighlightPosition() {}

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
    let colorString = this._settings.get_string("color");

    // system accent override
    if (
      this._interfaceSettings &&
      this._settings.get_boolean("use-system-accent")
    ) {
      const accent = this._interfaceSettings.get_string("accent-color");
      const ACCENT_COLORS = {
        blue: "rgba(53, 132, 228, 1)",
        teal: "rgba(99, 193, 190, 1)",
        green: "rgba(51, 209, 122, 1)",
        yellow: "rgba(246, 211, 45, 1)",
        orange: "rgba(255, 120, 0, 1)",
        red: "rgba(224, 27, 36, 1)",
        pink: "rgba(213, 97, 157, 1)",
        purple: "rgba(145, 65, 172, 1)",
        slate: "rgba(119, 118, 123, 1)",
        default: "rgba(53, 132, 228, 1)",
      };
      if (ACCENT_COLORS[accent]) {
        colorString = ACCENT_COLORS[accent];
      }
    }

    const color = this._parseColor(colorString);
    const borderWeight = this._settings.get_int("border-weight");
    const gap = this._settings.get_double("gap");
    const opacity = this._settings.get_double("opacity");
    const cornerRadius = this._settings.get_int("corner-radius");
    const rotation = this._settings.get_int("rotation");

    // Glow
    const glow = this._settings.get_boolean("glow");
    const glowRadius = this._settings.get_int("glow-radius");
    const glowSpread = this._settings.get_int("glow-spread");

    // Click Animations
    const clickAnimations = this._settings.get_boolean("click-animations");
    const clickAnimationMode = this._settings.get_string(
      "click-animation-mode",
    );

    // Shape
    const maxRadius = size / 2;
    const radiusPx = Math.round(maxRadius * (cornerRadius / 50.0));
    const radius = `${radiusPx}px`;

    // Store settings for draw callback
    this._drawSettings = {
      size: size,
      borderWeight: borderWeight,
      gap: gap,
      color: color,
      radiusPx: radiusPx,
      opacity: opacity,
      rotation: rotation,
      glow: glow,
      glowRadius: glowRadius,
      glowSpread: glowSpread,
      clickAnimations: clickAnimations,
      clickAnimationMode: this._settings.get_string("click-animation-mode"),
      dashedBorder: this._settings.get_boolean("dashed-border"),
      dashGapSize: this._settings.get_double("dash-gap-size"),
      useSystemAccent: this._settings.get_boolean("use-system-accent"),
      leftClickColor: this._parseColor(
        this._settings.get_string("left-click-color"),
      ),
      rightClickColor: this._parseColor(
        this._settings.get_string("right-click-color"),
      ),
    };

    // Canvas sizing and invalidation
    // Calculate padding based on glow to prevent clipping
    const glowPadding = glow ? glowRadius + glowSpread + 20 : 20;
    const padding = glowPadding;
    const totalSize = size + padding * 2;

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

    const {
      size,
      borderWeight,
      color,
      radiusPx,
      rotation,
      gap,
      glow,
      glowRadius,
      glowSpread,
      clickAnimations,
      clickAnimationMode,
    } = this._drawSettings;

    // --- Animation State Calculation ---
    let animScaleX = 1.0;
    let animScaleY = 1.0;
    let animTranslateX = 0;
    let drawColor = {
      r: color.red / 255,
      g: color.green / 255,
      b: color.blue / 255,
      a: color.alpha,
    }; // default

    if (
      clickAnimations &&
      this._clickState &&
      (this._clickState.active || this._clickState.progress > 0)
    ) {
      const progress = this._clickState.progress;
      const button = this._clickState.button; // 'left' or 'right'

      // color blending
      let targetR, targetG, targetB;

      if (button === "right") {
        targetR = this._drawSettings.rightClickColor.red / 255;
        targetG = this._drawSettings.rightClickColor.green / 255;
        targetB = this._drawSettings.rightClickColor.blue / 255;
      } else {
        targetR = this._drawSettings.leftClickColor.red / 255;
        targetG = this._drawSettings.leftClickColor.green / 255;
        targetB = this._drawSettings.leftClickColor.blue / 255;
      }

      // Simple blend: current * (1-p) + target * p
      const blend = Math.min(1.0, progress * 0.8); // Blend factor

      drawColor.r = drawColor.r * (1 - blend) + targetR * blend;
      drawColor.g = drawColor.g * (1 - blend) + targetG * blend;
      drawColor.b = drawColor.b * (1 - blend) + targetB * blend;
      // Alpha remains user setting usually, or we can boost it? Keep user setting.

      // 2. Shape Deformation
      if (clickAnimationMode === "ripple") {
        // Ripple: Squeeze to center
        // Scale down to 80% at peak
        const scale = 1.0 - progress * 0.2;
        animScaleX = scale;
        animScaleY = scale;
      } else {
        // Directional: Squeeze to side
        // Scale width down to 70%
        animScaleX = 1.0 - progress * 0.3;
        // Shift to keep anchor
        const shift = ((size * 0.3) / 2) * progress; // Shift by half the lost width
        if (button === "left") {
          // Squeeze to Left -> Move Left (visual squeeze towards left edge)
          animTranslateX = -shift;
        } else {
          // Squeeze to Right -> Move Right
          animTranslateX = shift;
        }
      }
    }
    // --- End Animation Calculation ---

    const centerX = width / 2;
    const centerY = height / 2;
    const rotationRad = (rotation || 0) * (Math.PI / 180);

    // Apply Transformations
    cr.translate(centerX, centerY);

    // Apply Click Animation Transforms (Before rotation, so they are Screen-Aligned)
    cr.translate(animTranslateX, 0);
    cr.scale(animScaleX, animScaleY);

    // Apply Shape Rotation
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
        cr.arc(x + r, y + r, r, Math.PI, (3 * Math.PI) / 2);
      } else {
        cr.rectangle(x, y, w, h);
      }
      cr.closePath();
    };

    // Calculate ring dimensions
    // Outer: borderWeight px, 100% opaque
    // Inner: borderWeight + 1 px, user's opacity
    // Gap: User defined
    const outerBorderWidth = borderWeight;
    const innerBorderWidth = borderWeight + 1;
    // const gap is destructured above

    const outerHalf = size / 2;
    // Inner ring starts where outer ring ends plus gap
    const innerHalf = outerHalf - outerBorderWidth - gap - innerBorderWidth / 2;
    const outerRadius = radiusPx;
    const innerRadius = Math.max(0, radiusPx - outerBorderWidth - gap);

    // 0. GLOW EFFECT (Behind everything)
    if (glow && glowRadius > 0) {
      cr.save();
      const glowPathHalfW = outerHalf; // Outer edge of outer ring

      cr.rectangle(-width, -height, width * 2, height * 2); // Universe
      drawRoundedRect(outerHalf - outerBorderWidth, outerRadius); // Inner edge of outer ring?

      // Draw Glow with BLENDED color
      cr.setSourceRGBA(
        drawColor.r,
        drawColor.g,
        drawColor.b,
        (drawColor.a * 0.5) / 10,
      );

      // Simulate blur with multiple strokes
      const steps = 10;
      for (let i = 0; i < steps; i++) {
        const spread = glowSpread + glowRadius * (i / steps);
        cr.setLineWidth(outerBorderWidth + spread);
        drawRoundedRect(outerHalf - outerBorderWidth / 2, outerRadius);
        cr.stroke();
      }

      // Clip Inner Region (Cleanup)
      cr.setOperator(0); // CLEAR
      cr.setSourceRGBA(0, 0, 0, 1);
      cr.setLineWidth(1);
      drawRoundedRect(
        outerHalf - outerBorderWidth,
        Math.max(0, outerRadius - outerBorderWidth),
      );
      cr.fill(); // This eats the inner bleed

      cr.restore(); // Restore context (operator, etc)
    }

    // 1. DRAW OUTER RING (100% Opaque)
    cr.setSourceRGBA(
      drawColor.r,
      drawColor.g,
      drawColor.b,
      1.0, // Always 100% opaque
    );
    cr.setLineWidth(outerBorderWidth);
    drawRoundedRect(outerHalf - outerBorderWidth / 2, outerRadius);
    cr.stroke();

    // 2. DRAW INNER RING (User's opacity setting)
    const { opacity, dashedBorder, dashGapSize } = this._drawSettings;
    cr.setSourceRGBA(drawColor.r, drawColor.g, drawColor.b, opacity);
    cr.setLineWidth(innerBorderWidth);

    if (dashedBorder) {
      // calculate perimeter of the inner ring path
      // Perimeter = 4 * StraightSegments + 4 * QuarterCircles
      // StraightSegment = (2 * innerHalf) - (2 * innerRadius)
      // QuarterCircle = (PI/2) * innerRadius
      // Total = 4 * (2*innerHalf - 2*innerRadius) + 2*PI*innerRadius
      const perimeter =
        8 * (innerHalf - innerRadius) + 2 * Math.PI * innerRadius;

      const dashLen = 2.0; // fixed tick width
      const targetGap = Math.max(1.5, dashGapSize);
      const targetUnit = dashLen + targetGap;

      // find best fit integer count
      let count = Math.round(perimeter / targetUnit);
      if (count < 4) count = 4; // ensure minimal dash count

      // recalculate exact gap to close the loop perfectly
      const actualUnit = perimeter / count;
      const actualGap = actualUnit - dashLen;

      // apply dash
      cr.setDash([dashLen, actualGap], 0);
    }

    drawRoundedRect(innerHalf, innerRadius);
    cr.stroke();

    // reset dash just in case
    cr.setDash([], 0);

    // dispose context when done
    cr.$dispose();
  }

  _getShapeValue(shapeString) {
    switch (shapeString) {
      case "circle":
        return 0.0;
      case "squircle":
        return 1.0;
      case "square":
        return 2.0;
      default:
        return 0.0;
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
