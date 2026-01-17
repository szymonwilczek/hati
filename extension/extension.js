// extension.js - Hati Cursor Highlighter for GNOME Shell
// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import St from "gi://St";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

export default class HatiExtension extends Extension {
  constructor(metadata) {
    super(metadata);
    this._highlightActor = null;
    this._updateId = null;
    this._settings = null;
  }

  enable() {
    console.log("[Hati] Enabling cursor highlighter...");

    this._settings = this.getSettings("org.hati.Highlighter");

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

    // simple circular actor (for now, without shader)
    this._highlightActor = new St.Bin({
      style_class: "hati-highlight",
      width: size,
      height: size,
      opacity: Math.floor(opacity * 255),
      reactive: false,
      can_focus: false,
    });

    // styling
    const borderWeight = this._settings.get_int("border-weight");
    const colorStr = `rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha})`;

    this._highlightActor.set_style(`
            border: ${borderWeight}px solid ${colorStr};
            border-radius: ${size / 2}px;
            background-color: transparent;
        `);

    // add to the UI group (above windows, below UI)
    Main.uiGroup.add_child(this._highlightActor);

    console.log("[Hati] Highlight actor created");
  }

  _destroyHighlightActor() {
    if (this._highlightActor) {
      Main.uiGroup.remove_child(this._highlightActor);
      this._highlightActor.destroy();
      this._highlightActor = null;
      console.log("[Hati] Highlight actor destroyed");
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
    if (!this._highlightActor) {
      return;
    }

    // get global pointer position
    const [x, y] = global.get_pointer();

    // center the highlight on cursor
    const size = this._settings.get_int("size");
    const centerX = x - size / 2;
    const centerY = y - size / 2;

    // update actor position
    this._highlightActor.set_position(centerX, centerY);
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
