// extension.js - Hati Cursor Highlighter for GNOME Shell
// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from "gi://Clutter";
import Cogl from "gi://Cogl";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import St from "gi://St";
import Gio from "gi://Gio";
import Cairo from "gi://cairo";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { parseColor } from "./utils.js";
import { Physics } from "./modules/physics.js";
import { Glow } from "./modules/glow.js";
import { getAnimation } from "./animations/animations.js";

// GLSL Shader for rounded corners clipping
const SHADER_DECLARATIONS = `
uniform vec4 bounds;
uniform float clipRadius;
uniform vec2 pixelStep;

float getPointOpacity(vec2 p, float radius) {
    float width = bounds.z;
    float height = bounds.w;
    
    if (radius <= 0.0)
        return 1.0;
    
    float centerLeft = radius;
    float centerRight = width - radius;
    float centerTop = radius;
    float centerBottom = height - radius;
    
    vec2 center;
    
    if (p.x < centerLeft)
        center.x = centerLeft;
    else if (p.x > centerRight)
        center.x = centerRight;
    else
        return 1.0;
    
    if (p.y < centerTop)
        center.y = centerTop;
    else if (p.y > centerBottom)
        center.y = centerBottom;
    else
        return 1.0;
    
    vec2 delta = p - center;
    float distSquared = dot(delta, delta);
    
    float outerRadius = radius + 0.5;
    if (distSquared >= (outerRadius * outerRadius))
        return 0.0;
    
    float innerRadius = radius - 0.5;
    if (distSquared <= (innerRadius * innerRadius))
        return 1.0;
    
    return outerRadius - sqrt(distSquared);
}
`;

const SHADER_CODE = `
vec2 p = cogl_tex_coord0_in.xy / pixelStep;
float alpha = getPointOpacity(p, clipRadius);
cogl_color_out *= alpha;
`;

// for rounded corners clipping
const MagnifierClipEffect = GObject.registerClass(
  {},
  class MagnifierClipEffect extends Shell.GLSLEffect {
    _init() {
      super._init();
      this._boundsLoc = this.get_uniform_location("bounds");
      this._clipRadiusLoc = this.get_uniform_location("clipRadius");
      this._pixelStepLoc = this.get_uniform_location("pixelStep");
      console.log("[Hati] MagnifierClipEffect initialized");
    }

    vfunc_build_pipeline() {
      this.add_glsl_snippet(
        Cogl.SnippetHook.FRAGMENT,
        SHADER_DECLARATIONS,
        SHADER_CODE,
        false,
      );
    }

    updateUniforms(width, height, cornerRadius) {
      const pixelStep = [1.0 / width, 1.0 / height];
      const bounds = [0, 0, width, height];

      this.set_uniform_float(this._boundsLoc, 4, bounds);
      this.set_uniform_float(this._clipRadiusLoc, 1, [cornerRadius]);
      this.set_uniform_float(this._pixelStepLoc, 2, pixelStep);
      this.queue_repaint();

      console.log(
        `[Hati ClipEffect] Updated: ${width}x${height}, radius=${cornerRadius}`,
      );
    }
  },
);

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

    this._highlightActor = this._canvas;
    this._outerRing = this._canvas;
    this._innerRing = null;

    this._magnifierGroup = new St.Widget({
      style: "background-color: transparent;",
      visible: false,
      width: 300,
      height: 300,
      clip_to_allocation: true,
      offscreen_redirect: Clutter.OffscreenRedirect.ALWAYS,
    });

    // CONTENT GROUP: will hold the clones and apply counter-rotation
    this._contentGroup = new St.Widget({
      width: 300,
      height: 300,
    });
    this._magnifierGroup.add_child(this._contentGroup);

    // magnifier activation state
    this._magnifierActive = false;
    this._magnifierKeyPressed = false;

    // shader effect for rounded clipping
    this._clipEffect = null;

    const monitor = Main.layoutManager.primaryMonitor;

    // LAYER 1: Background - try to get actual background content
    this._bgClone = null;

    // LAYER 2: All Windows (Dynamic) - updated each tick
    this._windowClones = [];
    this._lastWindowSnapshot = null;

    // LAYER 3: Panel (Top Bar) - always on top

    // ensure visibility over fullscreen apps
    Main.layoutManager.addChrome(this._magnifierGroup, {
      trackFullscreen: true,
    }); // hidden by default

    // magnifier activation
    this._stageEventId = global.stage.connect(
      "captured-event",
      (actor, event) => {
        return this._onStageEvent(event);
      },
    );

    // Physics
    this._physics = new Physics(this._settings);
    this._tickId = 0;

    // Glow
    this._glow = new Glow(this._settings);

    // Initial Style
    this._refreshStyle();

    // Add to UI
    Main.layoutManager.addChrome(this._containerActor, {
      trackFullscreen: true,
    });

    // Start Physics
    this._tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
      this._tick();
      return GLib.SOURCE_CONTINUE;
    });

    console.log("[Hati] Highlight actor created (CSS Mode - Reverted)");
  }

  _updatePhysicsConstants() {
    if (this._physics) {
      this._physics.updateConstants();
    }
  }

  _removeHighlightActor() {
    if (this._containerActor) {
      if (this._tickId) {
        GLib.source_remove(this._tickId);
        this._tickId = 0;
      }

      // disconnect stage event handler
      if (this._stageEventId) {
        global.stage.disconnect(this._stageEventId);
        this._stageEventId = null;
      }

      Main.layoutManager.removeChrome(this._containerActor);
      this._containerActor.destroy();
      this._containerActor = null;

      if (this._magnifierGroup) {
        Main.layoutManager.removeChrome(this._magnifierGroup);
        this._magnifierGroup.destroy();
        this._magnifierGroup = null;
      }
      this._magnifierClone = null;

      if (this._magnifierGhost) {
        Main.uiGroup.remove_child(this._magnifierGhost);
        this._magnifierGhost.destroy();
        this._magnifierGhost = null;
      }

      this._outerRing = null;
      this._innerRing = null;
    }
  }

  // MAGNIFIER: Key Event Handler
  _onStageEvent(event) {
    // only handle key events
    const type = event.type();
    if (
      type !== Clutter.EventType.KEY_PRESS &&
      type !== Clutter.EventType.KEY_RELEASE
    ) {
      return Clutter.EVENT_PROPAGATE;
    }

    const activationKey =
      this._settings.get_string("magnifier-key") || "Shift_L";
    const keyName = event.get_key_symbol();

    const keyMap = {
      Shift_L: Clutter.KEY_Shift_L,
      Shift_R: Clutter.KEY_Shift_R,
      Control_L: Clutter.KEY_Control_L,
      Control_R: Clutter.KEY_Control_R,
      Alt_L: Clutter.KEY_Alt_L,
      Alt_R: Clutter.KEY_Alt_R,
      Super_L: Clutter.KEY_Super_L,
      Super_R: Clutter.KEY_Super_R,
    };

    const targetKey = keyMap[activationKey] || Clutter.KEY_Shift_L;

    if (keyName !== targetKey) {
      return Clutter.EVENT_PROPAGATE;
    }

    if (type === Clutter.EventType.KEY_PRESS && !this._magnifierKeyPressed) {
      // KEY DOWN - activate magnifier
      this._magnifierKeyPressed = true;
      this._activateMagnifier();
      return Clutter.EVENT_STOP;
    } else if (
      type === Clutter.EventType.KEY_RELEASE &&
      this._magnifierKeyPressed
    ) {
      // KEY UP - deactivate magnifier
      this._magnifierKeyPressed = false;
      this._deactivateMagnifier();
      return Clutter.EVENT_STOP;
    }

    return Clutter.EVENT_PROPAGATE;
  }

  // MAGNIFIER: Activation
  _activateMagnifier() {
    // check if interrupting an exit animation
    const isInterruptedExit =
      this._magnifierGroup.visible && this._magnifierGroup.opacity > 0;
    if (this._magnifierActive && !isInterruptedExit) {
      // if active, full visibility and cancel any exit animations
      this._magnifierGroup.remove_all_transitions();
      this._magnifierGroup.opacity = 255;
      this._magnifierGroup.set_scale(1.0, 1.0);
      this._magnifierGroup.visible = true;
      this._magnifierActive = true;
      return;
    }

    console.log("[Hati] Magnifier ACTIVATED (Spring Pop)");
    this._magnifierActive = true;

    // stop any running animations
    this._magnifierGroup.remove_all_transitions();

    if (isInterruptedExit) {
      // SOFT REACTIVATION: keep physics/position context
      console.log("[Hati] Soft Reactivation (Interrupted Exit)");
    } else {
      // HARD ACTIVATION: reset everything
      this._magnifierGroup.opacity = 0;
      this._magnifierGroup.set_scale(0.5, 0.5);

      // sync position immediately to prevent flicker/jump from old position
      const [pointerX, pointerY] = global.get_pointer();
      this._physics.reset(pointerX, pointerY);
    }

    // create clones on-demand
    const monitor = Main.layoutManager.primaryMonitor;
    this._tryCreateBackgroundClone(monitor);
    this._rebuildWindowClones();

    // create panel clone if not exists
    if (!this._panelClone) {
      const panelSource = Main.layoutManager.panelBox;
      if (panelSource) {
        this._panelClone = new Clutter.Clone({
          source: panelSource,
          reactive: false,
        });
        this._contentGroup.add_child(this._panelClone);
      }
    }

    // create and apply rounded corners clipping effect
    if (!this._clipEffect) {
      this._clipEffect = new MagnifierClipEffect();
      this._magnifierGroup.add_effect(this._clipEffect);
      console.log("[Hati] Clip effect added to magnifier");
    }

    // force one tick update to position everything correctly BEFORE showing
    this._tick();

    // Show and Animate
    this._magnifierGroup.visible = true;

    this._magnifierGroup.ease({
      opacity: 255,
      scale_x: 1.0,
      scale_y: 1.0,
      duration: 250,
      mode: Clutter.AnimationMode.EASE_OUT_EXPO,
    });
  }

  // MAGNIFIER: Deactivation
  _deactivateMagnifier() {
    if (!this._magnifierActive) return;

    console.log("[Hati] Magnifier DEACTIVATED (Spring Pop Exit)");
    this._magnifierActive = false;

    // stop any entrance animation
    this._magnifierGroup.remove_all_transitions();

    // animate out
    this._magnifierGroup.ease({
      opacity: 0,
      scale_x: 0.8,
      scale_y: 0.8,
      duration: 150,
      mode: Clutter.AnimationMode.EASE_IN_QUART,
      onComplete: () => {
        // only clean up if still inactive
        if (!this._magnifierActive) {
          this._magnifierGroup.visible = false;
          this._cleanupMagnifierResources();
        }
      },
    });
  }

  _cleanupMagnifierResources() {
    if (this._bgClone) {
      this._contentGroup.remove_child(this._bgClone);
      this._bgClone.destroy();
      this._bgClone = null;
    }

    this._windowClones.forEach((clone) => {
      if (clone) {
        this._contentGroup.remove_child(clone);
        clone.destroy();
      }
    });
    this._windowClones = [];

    if (this._panelClone) {
      this._contentGroup.remove_child(this._panelClone);
      this._panelClone.destroy();
      this._panelClone = null;
    }

    // Remove shader effect
    if (this._clipEffect) {
      this._magnifierGroup.remove_effect(this._clipEffect);
      this._clipEffect = null;
    }
  }

  _startCursorTracking() {}
  _stopCursorTracking() {}

  // MAGNIFIER HELPER: background clone
  _tryCreateBackgroundClone(monitor) {
    if (this._bgClone) return;

    try {
      const bgManagers = Main.layoutManager._bgManagers;
      if (bgManagers && bgManagers.length > 0) {
        // get the background actor for primary monitor
        const bgManager = bgManagers[0];
        if (bgManager && bgManager.backgroundActor) {
          this._bgClone = new Clutter.Clone({
            source: bgManager.backgroundActor,
            reactive: false,
          });
          this._bgClone._sourceActor = { x: 0, y: 0 }; // background is at 0,0
          this._contentGroup.insert_child_at_index(this._bgClone, 0);
          console.log(`[Hati] Background clone created successfully!`);
          return;
        }
      }
    } catch (e) {
      console.log(`[Hati] Failed to get background via bgManagers: ${e}`);
    }

    // fallback: try layoutManager.backgroundGroup first child
    try {
      const bgGroup = Main.layoutManager.backgroundGroup;
      if (bgGroup && bgGroup.get_n_children() > 0) {
        const bgActor = bgGroup.get_child_at_index(0);
        if (bgActor) {
          this._bgClone = new Clutter.Clone({
            source: bgActor,
            reactive: false,
          });
          this._bgClone._sourceActor = { x: 0, y: 0 };
          this._contentGroup.insert_child_at_index(this._bgClone, 0);
          console.log(`[Hati] Background clone (fallback) created!`);
          return;
        }
      }
    } catch (e) {
      console.log(`[Hati] Background fallback also failed: ${e}`);
    }

    console.log(`[Hati] No background clone could be created`);
  }

  // MAGNIFIER HELPER: Rebuild All Window Clones
  _rebuildWindowClones() {
    if (!this._magnifierGroup) return;

    // clean up old clones
    this._windowClones.forEach((clone) => {
      if (clone) {
        this._contentGroup.remove_child(clone);
        clone.destroy();
      }
    });
    this._windowClones = [];

    // get all windows on the current workspace
    const workspace = global.workspace_manager.get_active_workspace();
    const windows = workspace.list_windows();

    // sort by stacking order (bottom to top)
    windows.sort((a, b) => {
      const actorA = a.get_compositor_private();
      const actorB = b.get_compositor_private();
      if (!actorA || !actorB) return 0;
      // lower z-index first
      return (
        global.window_group.get_child_index(actorA) -
        global.window_group.get_child_index(actorB)
      );
    });

    // clone each visible window
    for (const win of windows) {
      // skip minimized, hidden, or special windows
      if (win.is_hidden() || win.minimized) continue;

      const actor = win.get_compositor_private();
      if (!actor || !actor.visible) continue;

      try {
        const clone = new Clutter.Clone({
          source: actor,
          reactive: false,
        });
        // store source reference for coordinate math
        clone._sourceActor = actor;

        // insert above background, below panel
        const insertIndex = this._bgClone ? 1 : 0;
        this._contentGroup.insert_child_at_index(
          clone,
          insertIndex + this._windowClones.length,
        );

        this._windowClones.push(clone);
      } catch (e) {
        console.log(`[Hati] Failed to clone window: ${win.get_title()}: ${e}`);
      }
    }
  }

  _getActivationMask() {
    const key = this._settings.get_string("magnifier-key") || "Shift_L";
    if (key.includes("Shift")) return Clutter.ModifierType.SHIFT_MASK;
    if (key.includes("Control")) return Clutter.ModifierType.CONTROL_MASK;
    if (key.includes("Alt")) return Clutter.ModifierType.MOD1_MASK;
    if (key.includes("Super")) return Clutter.ModifierType.SUPER_MASK;
    return Clutter.ModifierType.SHIFT_MASK; // Default fallback
  }

  _tick() {
    if (!this._containerActor || !this._highlightActor)
      return Clutter.TICK_STOP;

    const [pointerX, pointerY, mask] = global.get_pointer();
    const containerWidth = this._containerActor.get_width();
    const containerHeight = this._containerActor.get_height();

    // Activation Polling Logic
    const activationMask = this._getActivationMask();
    const isPressed = (mask & activationMask) !== 0;

    if (isPressed) {
      if (!this._magnifierActive) {
        this._activateMagnifier();
      }
    } else {
      if (this._magnifierActive) {
        this._deactivateMagnifier();
      }
    }

    // Physics Update
    const [curX, curY] = this._physics.update(pointerX, pointerY);

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
      const speed = 0.15;

      if (!this._clickState.closing) {
        if (this._clickState.progress < 1.0) {
          this._clickState.progress = Math.min(
            1.0,
            this._clickState.progress + speed,
          );
          this._canvas.queue_repaint();
        }
      } else {
        if (this._clickState.progress > 0.0) {
          this._clickState.progress = Math.max(
            0.0,
            this._clickState.progress - speed,
          );
          this._canvas.queue_repaint();
        } else {
          this._clickState.active = false;
          this._clickState.button = null;
        }
      }
    }

    this._containerActor.set_position(
      curX - containerWidth / 2,
      curY - containerHeight / 2,
    );

    // Edge Squish
    const monitor = Main.layoutManager.primaryMonitor;
    if (!monitor) return Clutter.TICK_CONTINUE;

    const distLeft = curX - monitor.x;
    const distRight = monitor.x + monitor.width - curX;
    const distTop = curY - monitor.y;
    const distBottom = monitor.y + monitor.height - curY;

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

    // Update Magnifier Position & Zoom (only when active)
    if (this._magnifierGroup && this._magnifierActive) {
      const size = this._settings.get_int("size") || 100;
      const zoom = this._settings.get_double("magnifier-zoom") || 2.0;
      const borderWeight = this._settings.get_int("border-weight") || 4;
      const gap = this._settings.get_double("gap") || 1.0;
      const cornerRadius = this._settings.get_int("corner-radius") || 50;
      const rotation = this._settings.get_int("rotation") || 0;

      // FULL DESKTOP CLONING
      // rebuild window clones periodically
      if (
        !this._lastWindowRebuild ||
        Date.now() - this._lastWindowRebuild > 500 // every ~500ms to avoid perf hit
      ) {
        this._rebuildWindowClones();
        this._lastWindowRebuild = Date.now();
      }

      // MAGNIFIER SIZE: should fit to inner edge of OUTER ring
      // Geometry: outerHalf = size/2, outer ring thickness = borderWeight
      // Inner edge of outer ring = outerHalf - borderWeight
      const outerHalf = size / 2;
      const innerEdgeOfOuterRing = outerHalf - borderWeight;
      const magnifierDiameter = Math.max(20, innerEdgeOfOuterRing * 2);

      // calculate corner radius proportionally
      const maxRadiusPx = magnifierDiameter / 2;
      const magnifierRadius = Math.round(maxRadiusPx * (cornerRadius / 50.0));

      // DEBUG LOGGING
      if (!this._lastLogTime || Date.now() - this._lastLogTime > 2000) {
        console.log(
          `[Hati Magnifier] size=${size}, borderWeight=${borderWeight}, cornerRadius=${cornerRadius}`,
        );
        console.log(
          `[Hati Magnifier] outerHalf=${outerHalf}, innerEdgeOfOuterRing=${innerEdgeOfOuterRing}`,
        );
        console.log(
          `[Hati Magnifier] magnifierDiameter=${magnifierDiameter}, magnifierRadius=${magnifierRadius}`,
        );
        console.log(`[Hati Magnifier] rotation=${rotation}`);
        this._lastLogTime = Date.now();
      }

      this._magnifierGroup.set_size(magnifierDiameter, magnifierDiameter);

      // update shader effect uniforms for rounded clipping
      if (this._clipEffect) {
        this._clipEffect.updateUniforms(
          magnifierDiameter,
          magnifierDiameter,
          magnifierRadius,
        );
      }

      // apply rotation around center (frame rotates clockwise)
      this._magnifierGroup.set_pivot_point(0.5, 0.5);
      this._magnifierGroup.set_rotation_angle(
        Clutter.RotateAxis.Z_AXIS,
        rotation,
      );

      // update content group size and apply counter-rotation (content rotates counter-clockwise)
      // this keeps the content upright while the frame rotates
      this._contentGroup.set_size(magnifierDiameter, magnifierDiameter);
      this._contentGroup.set_pivot_point(0.5, 0.5);
      this._contentGroup.set_rotation_angle(
        Clutter.RotateAxis.Z_AXIS,
        -rotation,
      );

      this._magnifierGroup.set_position(
        curX - magnifierDiameter / 2,
        curY - magnifierDiameter / 2,
      );

      // transform all layers
      const allLayers = [
        ...this._windowClones,
        this._bgClone,
        this._panelClone,
      ].filter((x) => x);

      allLayers.forEach((clone) => {
        if (!clone) return;

        let sourceX = 0;
        let sourceY = 0;

        // windows have positions, background and panel are at 0,0
        if (clone._sourceActor) {
          sourceX = clone._sourceActor.x;
          sourceY = clone._sourceActor.y;
        }

        clone.set_scale(zoom, zoom);
        clone.set_translation(
          magnifierDiameter / 2 - (curX - sourceX) * zoom,
          magnifierDiameter / 2 - (curY - sourceY) * zoom,
          0,
        );
      });
    }

    // update ghost position
    if (this._magnifierGhost) {
      const ghostSize = 100;
      this._magnifierGhost.set_position(
        curX - ghostSize / 2,
        curY - ghostSize / 2,
      );
    }

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

    if (key === "glow" || key === "glow-radius" || key === "glow-spread") {
      if (this._glow) {
        this._glow.updateConstants();
      }
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

    const color = parseColor(colorString);
    const borderWeight = this._settings.get_int("border-weight");
    const gap = this._settings.get_double("gap");
    const opacity = this._settings.get_double("opacity");
    const cornerRadius = this._settings.get_int("corner-radius");
    const rotation = this._settings.get_int("rotation");

    // Glow
    const glow = this._glow ? this._glow.isEnabled() : false;
    const glowRadius = this._glow ? this._glow.getRadius() : 0;
    const glowSpread = this._glow ? this._glow.getSpread() : 0;

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
      leftClickColor: parseColor(this._settings.get_string("left-click-color")),
      rightClickColor: parseColor(
        this._settings.get_string("right-click-color"),
      ),
    };

    // Canvas sizing and invalidation
    // Calculate padding based on glow to prevent clipping
    const padding = this._glow ? this._glow.calculatePadding() : 20;
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

      // Shape Deformation (from animation module)
      const animation = getAnimation(clickAnimationMode, this._settings);
      const transforms = animation.calculate({ progress, button, size });
      animScaleX = transforms.scaleX;
      animScaleY = transforms.scaleY;
      animTranslateX = transforms.translateX;
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
    if (this._glow) {
      this._glow.draw(
        cr,
        {
          outerHalf,
          outerRadius,
          outerBorderWidth,
          drawColor,
          width,
          height,
        },
        drawRoundedRect,
      );
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
}
