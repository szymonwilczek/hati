// modules/magnifier.js - Magnifier functionality
// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from "gi://Clutter";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { MagnifierClipEffect } from "../shaders/magnifier-clip-effect.js";

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

export class Magnifier {
  constructor(settings, physics) {
    this._settings = settings;
    this._physics = physics;

    // UI elements
    this._group = null;
    this._contentGroup = null;
    this._clipEffect = null;

    // clones
    this._bgClone = null;
    this._windowClones = [];
    this._panelClone = null;

    // state
    this._active = false;
    this._keyPressed = false;
    this._lastWindowRebuild = null;
    this._lastLogTime = null;
  }

  /**
   * Initialize magnifier UI elements
   * Call after extension UI is ready
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

    Main.layoutManager.addChrome(this._group, {
      trackFullscreen: true,
    });
  }

  /**
   * Destroy magnifier and clean up resources
   */
  destroy() {
    this._cleanupResources();

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
    const key = this._settings.get_string("magnifier-key") || "Shift_L";
    if (key.includes("Shift")) return Clutter.ModifierType.SHIFT_MASK;
    if (key.includes("Control")) return Clutter.ModifierType.CONTROL_MASK;
    if (key.includes("Alt")) return Clutter.ModifierType.MOD1_MASK;
    if (key.includes("Super")) return Clutter.ModifierType.SUPER_MASK;
    return Clutter.ModifierType.SHIFT_MASK;
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

    const activationKey =
      this._settings.get_string("magnifier-key") || "Shift_L";
    const keyName = event.get_key_symbol();
    const targetKey = KEY_MAP[activationKey] || Clutter.KEY_Shift_L;

    if (keyName !== targetKey) {
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
   * Check activation state via polling (for modifier keys while windows have focus)
   * @param {number} mask - Current modifier mask
   */
  pollActivation(mask) {
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

    const isInterruptedExit = this._group.visible && this._group.opacity > 0;
    if (this._active && !isInterruptedExit) {
      this._group.remove_all_transitions();
      this._group.opacity = 255;
      this._group.set_scale(1.0, 1.0);
      this._group.visible = true;
      return;
    }

    console.log("[Hati] Magnifier ACTIVATED");
    this._active = true;

    this._group.remove_all_transitions();

    if (!isInterruptedExit) {
      this._group.opacity = 0;
      this._group.set_scale(0.5, 0.5);

      const [pointerX, pointerY] = global.get_pointer();
      this._physics.reset(pointerX, pointerY);
    }

    // create clones
    this._tryCreateBackgroundClone();
    this._rebuildWindowClones();
    this._createPanelClone();

    // create clip effect
    if (!this._clipEffect) {
      this._clipEffect = new MagnifierClipEffect();
      this._group.add_effect(this._clipEffect);
    }

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

    console.log("[Hati] Magnifier DEACTIVATED");
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

    const size = this._settings.get_int("size") || 100;
    const zoom = this._settings.get_double("magnifier-zoom") || 2.0;
    const borderWeight = this._settings.get_int("border-weight") || 4;
    const cornerRadius = this._settings.get_int("corner-radius") || 50;
    const rotation = this._settings.get_int("rotation") || 0;

    // rebuild window clones periodically
    if (
      !this._lastWindowRebuild ||
      Date.now() - this._lastWindowRebuild > 500
    ) {
      this._rebuildWindowClones();
      this._lastWindowRebuild = Date.now();
    }

    // calculate magnifier size
    const outerHalf = size / 2;
    const innerEdgeOfOuterRing = outerHalf - borderWeight;
    const magnifierDiameter = Math.max(20, innerEdgeOfOuterRing * 2);
    const maxRadiusPx = magnifierDiameter / 2;
    const magnifierRadius = Math.round(maxRadiusPx * (cornerRadius / 50.0));

    // debug logging
    if (!this._lastLogTime || Date.now() - this._lastLogTime > 2000) {
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

    // transform clones
    const allLayers = [
      ...this._windowClones,
      this._bgClone,
      this._panelClone,
    ].filter((x) => x);

    allLayers.forEach((clone) => {
      if (!clone) return;

      let sourceX = 0;
      let sourceY = 0;

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

  // --- Private methods ---

  _cleanupResources() {
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

    if (this._clipEffect && this._group) {
      this._group.remove_effect(this._clipEffect);
      this._clipEffect = null;
    }
  }

  _tryCreateBackgroundClone() {
    if (this._bgClone) return;

    try {
      const bgManagers = Main.layoutManager._bgManagers;
      if (bgManagers && bgManagers.length > 0) {
        const bgManager = bgManagers[0];
        if (bgManager && bgManager.backgroundActor) {
          this._bgClone = new Clutter.Clone({
            source: bgManager.backgroundActor,
            reactive: false,
          });
          this._bgClone._sourceActor = { x: 0, y: 0 };
          this._contentGroup.insert_child_at_index(this._bgClone, 0);
          return;
        }
      }
    } catch (e) {
      console.log(`[Hati Magnifier] bgManagers failed: ${e}`);
    }

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
          return;
        }
      }
    } catch (e) {
      console.log(`[Hati Magnifier] backgroundGroup failed: ${e}`);
    }
  }

  _rebuildWindowClones() {
    if (!this._contentGroup) return;

    this._windowClones.forEach((clone) => {
      if (clone) {
        this._contentGroup.remove_child(clone);
        clone.destroy();
      }
    });
    this._windowClones = [];

    const workspace = global.workspace_manager.get_active_workspace();
    const windows = workspace.list_windows();

    windows.sort((a, b) => {
      const actorA = a.get_compositor_private();
      const actorB = b.get_compositor_private();
      if (!actorA || !actorB) return 0;
      return (
        global.window_group.get_child_index(actorA) -
        global.window_group.get_child_index(actorB)
      );
    });

    for (const win of windows) {
      if (win.is_hidden() || win.minimized) continue;

      const actor = win.get_compositor_private();
      if (!actor || !actor.visible) continue;

      try {
        const clone = new Clutter.Clone({
          source: actor,
          reactive: false,
        });
        clone._sourceActor = actor;

        const insertIndex = this._bgClone ? 1 : 0;
        this._contentGroup.insert_child_at_index(
          clone,
          insertIndex + this._windowClones.length,
        );

        this._windowClones.push(clone);
      } catch (e) {
        console.log(`[Hati Magnifier] Failed to clone: ${e}`);
      }
    }
  }

  _createPanelClone() {
    if (this._panelClone) return;

    const panelSource = Main.layoutManager.panelBox;
    if (panelSource) {
      this._panelClone = new Clutter.Clone({
        source: panelSource,
        reactive: false,
      });
      this._contentGroup.add_child(this._panelClone);
    }
  }
}
