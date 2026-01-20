// prefs/magnifier-group.js - Magnifier settings group
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";

/**
 * Build the Magnifier preferences group
 * @param {Gio.Settings} settings - Extension settings
 * @returns {Adw.PreferencesGroup}
 */
export function buildMagnifierGroup(settings) {
  const group = new Adw.PreferencesGroup({
    title: "Magnifier",
  });

  // Enable Toggle
  const enableRow = new Adw.SwitchRow({
    title: "Enable Magnifier",
    subtitle: "Hold key to magnify area under cursor",
  });
  settings.bind(
    "magnifier-enabled",
    enableRow,
    "active",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(enableRow);

  // Zoom Factor
  const zoomRow = new Adw.SpinRow({
    title: "Zoom Factor",
    subtitle: "Magnification level (1.0 - 4.0)",
    digits: 1,
    adjustment: new Gtk.Adjustment({
      lower: 1.0,
      upper: 4.0,
      step_increment: 0.1,
      page_increment: 0.5,
      value: settings.get_double("magnifier-zoom"),
    }),
  });
  settings.bind(
    "magnifier-zoom",
    zoomRow,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );
  settings.bind(
    "magnifier-enabled",
    zoomRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(zoomRow);

  // Activation Key
  const keyModel = new Gtk.StringList();
  const keyMap = [
    { name: "Left Shift", value: "Shift_L" },
    { name: "Right Shift", value: "Shift_R" },
    { name: "Left Ctrl", value: "Control_L" },
    { name: "Right Ctrl", value: "Control_R" },
    { name: "Left Alt", value: "Alt_L" },
    { name: "Right Alt", value: "Alt_R" },
    { name: "Left Super", value: "Super_L" },
    { name: "Right Super", value: "Super_R" },
  ];

  keyMap.forEach((k) => keyModel.append(k.name));

  const keyRow = new Adw.ComboRow({
    title: "Activation Key",
    subtitle: "Key to hold",
    model: keyModel,
  });

  // Set current key
  const currentKey = settings.get_string("magnifier-key");
  const keyIndex = keyMap.findIndex((k) => k.value === currentKey);
  keyRow.set_selected(keyIndex >= 0 ? keyIndex : 0);

  keyRow.connect("notify::selected", () => {
    const idx = keyRow.get_selected();
    if (idx < keyMap.length) {
      settings.set_string("magnifier-key", keyMap[idx].value);
    }
  });

  settings.bind(
    "magnifier-enabled",
    keyRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(keyRow);

  return group;
}
