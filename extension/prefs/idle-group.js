// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";

export function buildIdleGroup(settings) {
  const group = new Adw.PreferencesGroup({
    title: "Idle",
  });

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
