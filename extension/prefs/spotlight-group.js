// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";

export function buildSpotlightGroup(settings) {
  const group = new Adw.PreferencesGroup({
    title: "Spotlight",
  });

  const enabledRow = new Adw.SwitchRow({
    title: "Enable Spotlight",
    subtitle: "Darken screen and show hole around cursor",
  });
  settings.bind(
    "spotlight-enabled",
    enabledRow,
    "active",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(enabledRow);

  const activationKeyModel = new Gtk.StringList();
  activationKeyModel.append("Left Shift");
  activationKeyModel.append("Right Shift");
  activationKeyModel.append("Left Control");
  activationKeyModel.append("Right Control");
  activationKeyModel.append("Left Alt");
  activationKeyModel.append("Right Alt");
  activationKeyModel.append("Left Super");
  activationKeyModel.append("Right Super");

  const activationKeyRow = new Adw.ComboRow({
    title: "Activation Key",
    subtitle: "Key to hold",
    model: activationKeyModel,
  });

  const keys = [
    "Shift_L",
    "Shift_R",
    "Control_L",
    "Control_R",
    "Alt_L",
    "Alt_R",
    "Super_L",
    "Super_R",
  ];

  const currentKey = settings.get_string("spotlight-key");
  const keyIndex = keys.indexOf(currentKey);
  activationKeyRow.set_selected(keyIndex >= 0 ? keyIndex : 4); // default Alt_L

  activationKeyRow.connect("notify::selected", () => {
    const idx = activationKeyRow.get_selected();
    if (idx < keys.length) {
      settings.set_string("spotlight-key", keys[idx]);
    }
  });
  settings.bind(
    "spotlight-enabled",
    activationKeyRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(activationKeyRow);

  const opacityRow = new Adw.SpinRow({
    title: "Overlay Opacity",
    subtitle: "Darkness of the background",
    digits: 2,
    adjustment: new Gtk.Adjustment({
      lower: 0.1,
      upper: 1.0,
      step_increment: 0.05,
      page_increment: 0.1,
      value: settings.get_double("spotlight-opacity"),
    }),
  });
  settings.bind(
    "spotlight-opacity",
    opacityRow,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );
  settings.bind(
    "spotlight-enabled",
    opacityRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(opacityRow);

  const sizeRow = new Adw.SpinRow({
    title: "Spotlight Size",
    subtitle: "Diameter of the light circle",
    digits: 0,
    adjustment: new Gtk.Adjustment({
      lower: 50,
      upper: 500,
      step_increment: 10,
      page_increment: 50,
      value: settings.get_int("spotlight-size"),
    }),
  });
  settings.bind(
    "spotlight-size",
    sizeRow,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );
  settings.bind(
    "spotlight-enabled",
    sizeRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(sizeRow);

  return group;
}
