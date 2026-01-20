// modules/scene-cloner.js - Scene cloning for magnifier
// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from "gi://Clutter";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

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
  }

  /**
   * Initialize all clones for the scene
   */
  init() {
    this._createBackgroundClone();
    this._rebuildWindowClones();
    this._createPanelClone();
  }

  /**
   * Destroy all clones and clean up resources
   */
  destroy() {
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
    // periodically rebuild window clones (every 500ms)
    if (
      rebuildWindows ||
      !this._lastWindowRebuild ||
      Date.now() - this._lastWindowRebuild > 500
    ) {
      this._rebuildWindowClones();
      this._lastWindowRebuild = Date.now();
    }

    // transform all clones
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
        diameter / 2 - (curX - sourceX) * zoom,
        diameter / 2 - (curY - sourceY) * zoom,
        0,
      );
    });
  }

  // --- PRIVATE METHODS ---

  _createBackgroundClone() {
    if (this._bgClone) return;

    // try bgManagers first
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
      console.log(`[Hati SceneCloner] bgManagers failed: ${e}`);
    }

    // fallback to backgroundGroup
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
      console.log(`[Hati SceneCloner] backgroundGroup failed: ${e}`);
    }
  }

  _rebuildWindowClones() {
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

    // get windows from active workspace
    let windows = [];
    try {
      const workspace = global.workspace_manager.get_active_workspace();
      windows = workspace.list_windows();
    } catch (e) {
      console.log(`[Hati SceneCloner] Failed to get windows: ${e}`);
      return;
    }

    // sort by stacking order
    try {
      windows.sort((a, b) => {
        const actorA = a.get_compositor_private();
        const actorB = b.get_compositor_private();
        if (!actorA || !actorB) return 0;
        const indexA = global.window_group.get_child_index(actorA);
        const indexB = global.window_group.get_child_index(actorB);
        return indexA - indexB;
      });
    } catch (e) {
      // continue with unsorted windows
    }

    // clone each visible window (including popups and transients)
    for (const win of windows) {
      try {
        if (win.is_hidden() || win.minimized) continue;

        const actor = win.get_compositor_private();
        if (!actor || !actor.visible) continue;

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
        console.log(`[Hati SceneCloner] Skipping window: ${e.message}`);
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
