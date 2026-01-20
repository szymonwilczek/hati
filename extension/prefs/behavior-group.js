// prefs/behavior-group.js - Behavior settings group
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";

/**
 * Build the Behavior preferences group
 * @param {Gio.Settings} settings - Extension settings
 * @returns {Adw.PreferencesGroup}
 */
export function buildBehaviorGroup(settings) {
  const group = new Adw.PreferencesGroup({
    title: "Behavior",
  });

  // Click Animations Toggle
  const clickAnimationsRow = new Adw.SwitchRow({
    title: "Click Animations",
    subtitle: "Show ripple effect when clicking",
  });
  settings.bind(
    "click-animations",
    clickAnimationsRow,
    "active",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(clickAnimationsRow);

  // Animation Mode
  const modeModel = new Gtk.StringList();
  modeModel.append("Directional");
  modeModel.append("Ripple");

  const modeRow = new Adw.ComboRow({
    title: "Animation Mode",
    subtitle: "Style of click effect",
    model: modeModel,
  });

  // Set current mode
  const currentMode = settings.get_string("click-animation-mode");
  modeRow.set_selected(currentMode === "ripple" ? 1 : 0);

  modeRow.connect("notify::selected", () => {
    const modes = ["directional", "ripple"];
    const idx = modeRow.get_selected();
    settings.set_string("click-animation-mode", modes[idx]);
  });

  settings.bind(
    "click-animations",
    modeRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(modeRow);

  // Auto-hide Toggle
  const autoHideRow = new Adw.SwitchRow({
    title: "Auto-hide",
    subtitle: "Hide when cursor is stationary",
  });
  settings.bind(
    "auto-hide",
    autoHideRow,
    "active",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(autoHideRow);

  // Auto-hide Delay
  const delayRow = new Adw.SpinRow({
    title: "Hide Delay",
    subtitle: "Seconds before hiding (1-15)",
    digits: 1,
    adjustment: new Gtk.Adjustment({
      lower: 1.0,
      upper: 15.0,
      step_increment: 0.5,
      page_increment: 1.0,
      value: settings.get_int("auto-hide-delay") / 1000.0,
    }),
  });

  // convert seconds <-> ms
  delayRow.connect("notify::value", () => {
    const seconds = delayRow.get_value();
    settings.set_int("auto-hide-delay", Math.round(seconds * 1000));
  });

  settings.bind(
    "auto-hide",
    delayRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(delayRow);

  return group;
}
