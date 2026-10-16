// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Szymon Wilczek

import Clutter from "gi://Clutter";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { debugLog } from "../debug.js";

/**
 * Manages cloning of desktop scene elements (background, windows, panel)
 * for the magnifier view.
 */
export class SceneCloner {
  constructor(contentGroup) {
    this._contentGroup = contentGroup;

    // clones
    this._bgClone = null;
    this._windowClones = [];
    this._panelClone = null;

    // timing
    this._lastWindowRebuild = null;
    this._needsRebuild = false;
    this._restackedId = null;
  }

  /**
   * Initialize all clones for the scene
   */
  init() {
    this._createBackgroundClone();
    this._rebuildWindowClones();
    this._createPanelClone();

    // rebuild on the next frame after a restack instead of waiting for
    // the periodic rebuild, so a raised window shows up immediately.
    // init() runs again when the magnifier is re-activated during its
    // closing animation, so only connect once
    this._restackedId ??= global.display.connect("restacked", () => {
      this._needsRebuild = true;
    });
  }

  /**
   * Destroy all clones and clean up resources
   */
  destroy() {
    if (this._restackedId) {
      global.display.disconnect(this._restackedId);
      this._restackedId = null;
    }

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
  }

  /**
   * Update clone positions based on cursor and zoom
   * @param {number} curX - Cursor X position
   * @param {number} curY - Cursor Y position
   * @param {number} zoom - Zoom level
   * @param {number} diameter - Magnifier diameter
   * @param {boolean} rebuildWindows - Whether to rebuild window clones
   */
  update(curX, curY, zoom, diameter, rebuildWindows = false) {
    // periodically re-check the window set (every 500ms),
    // clones are only recreated when it actually changed
    if (
      rebuildWindows ||
      this._needsRebuild ||
      !this._lastWindowRebuild ||
      Date.now() - this._lastWindowRebuild > 500
    ) {
      this._syncWindowClones();
      this._lastWindowRebuild = Date.now();
      this._needsRebuild = false;
    }

    // transform all clones
    for (const clone of this._windowClones)
      this._transformClone(clone, curX, curY, zoom, diameter);
    if (this._bgClone)
      this._transformClone(this._bgClone, curX, curY, zoom, diameter);
    if (this._panelClone)
      this._transformClone(this._panelClone, curX, curY, zoom, diameter);
  }

  _transformClone(clone, curX, curY, zoom, diameter) {
    let sourceX = 0;
    let sourceY = 0;

    if (clone._sourceActor) {
      sourceX = clone._sourceActor.x;
      sourceY = clone._sourceActor.y;
    }

    const scale = Math.fround(zoom);
    const tx = Math.fround(diameter / 2 - (curX - sourceX) * zoom);
    const ty = Math.fround(diameter / 2 - (curY - sourceY) * zoom);
    if (clone.scale_x !== scale || clone.scale_y !== scale)
      clone.set_scale(scale, scale);
    if (clone.translation_x !== tx || clone.translation_y !== ty)
      clone.set_translation(tx, ty, 0);
  }

  /**
   * Window actors that should be visible in the magnifier, bottom to top
   * @returns {Array|null} - null if the window list could not be read
   */
  _visibleWindowActors() {
    let actors = [];
    let workspace = null;
    try {
      actors = global.get_window_actors();
      workspace = global.workspace_manager.get_active_workspace();
    } catch (e) {
      debugLog(`[Hati SceneCloner] Failed to get windows: ${e}`);
      return null;
    }

    return actors.filter((actor) => {
      try {
        const win = actor.meta_window;
        if (!win || win.is_hidden() || win.minimized) return false;
        if (!win.located_on_workspace(workspace)) return false;
        return actor.visible;
      } catch (e) {
        debugLog(`[Hati SceneCloner] Skipping window: ${e.message}`);
        return false;
      }
    });
  }

  /**
   * Rebuild window clones only if the visible windows or their stacking
   * order changed since the last rebuild
   */
  _syncWindowClones() {
    const actors = this._visibleWindowActors();
    if (!actors) return;

    const unchanged =
      actors.length === this._windowClones.length &&
      actors.every((actor, i) => this._windowClones[i]._sourceActor === actor);
    if (unchanged) return;

    this._rebuildWindowClones(actors);
  }

  _createBackgroundClone() {
    if (this._bgClone) return;

    // clone the whole background group: it holds the wallpaper of every
    // monitor at that monitor's position, and keeps doing so when the
    // wallpaper changes and its actors are replaced
    try {
      const bgGroup = Main.layoutManager._backgroundGroup;
      if (bgGroup) {
        this._bgClone = new Clutter.Clone({
          source: bgGroup,
          reactive: false,
        });
        this._bgClone._sourceActor = { x: 0, y: 0 };
        this._contentGroup.insert_child_at_index(this._bgClone, 0);
        return;
      }
    } catch (e) {
      debugLog(`[Hati SceneCloner] backgroundGroup failed: ${e}`);
    }

    // fallback to the first monitor's background
    try {
      const bgActor = Main.layoutManager._bgManagers?.[0]?.backgroundActor;
      if (bgActor) {
        this._bgClone = new Clutter.Clone({
          source: bgActor,
          reactive: false,
        });
        this._bgClone._sourceActor = { x: 0, y: 0 };
        this._contentGroup.insert_child_at_index(this._bgClone, 0);
      }
    } catch (e) {
      debugLog(`[Hati SceneCloner] bgManagers failed: ${e}`);
    }
  }

  _rebuildWindowClones(actors = this._visibleWindowActors()) {
    if (!this._contentGroup) return;

    // clean up old clones
    this._windowClones.forEach((clone) => {
      if (clone) {
        try {
          this._contentGroup.remove_child(clone);
          clone.destroy();
        } catch (e) {
          // ignore cleanup errors
        }
      }
    });
    this._windowClones = [];
    if (!actors) return;

    for (const actor of actors) {
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
        // skip windows that fail to clone
        debugLog(`[Hati SceneCloner] Skipping window: ${e.message}`);
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
