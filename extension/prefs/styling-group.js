// prefs/styling-group.js - Border and glow styling
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";

export function buildStylingGroup(settings) {
  const group = new Adw.PreferencesGroup({
    title: "Styling",
  });

  // Border Weight
  const borderWeightRow = new Adw.SpinRow({
    title: "Border Weight",
    subtitle: "Ring thickness",
    adjustment: new Gtk.Adjustment({
      lower: 2,
      upper: 20,
      step_increment: 1,
      page_increment: 2,
      value: settings.get_int("border-weight"),
    }),
  });
  settings.bind(
    "border-weight",
    borderWeightRow,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(borderWeightRow);

  // Gap
  const gapRow = new Adw.SpinRow({
    title: "Ring Gap",
    subtitle: "Space between rings",
    digits: 1,
    adjustment: new Gtk.Adjustment({
      lower: 0.0,
      upper: 20.0,
      step_increment: 0.5,
      page_increment: 1.0,
      value: settings.get_double("gap"),
    }),
  });
  settings.bind("gap", gapRow, "value", Gio.SettingsBindFlags.DEFAULT);
  group.add(gapRow);

  // Dashed Border Toggle
  const dashedBorderRow = new Adw.SwitchRow({
    title: "Dashed Inner Border",
    subtitle: "Make the inner ring dashed",
  });
  settings.bind(
    "dashed-border",
    dashedBorderRow,
    "active",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(dashedBorderRow);

  // Dash Gap Size
  const dashGapRow = new Adw.SpinRow({
    title: "Dash Density",
    subtitle: "Gap between ticks (lower = denser)",
    digits: 1,
    adjustment: new Gtk.Adjustment({
      lower: 1.5,
      upper: 5.0,
      step_increment: 0.5,
      page_increment: 1.0,
      value: settings.get_double("dash-gap-size"),
    }),
  });
  settings.bind(
    "dash-gap-size",
    dashGapRow,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );
  settings.bind(
    "dashed-border",
    dashGapRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(dashGapRow);

  // Glow Toggle
  const glowRow = new Adw.SwitchRow({
    title: "Glow Effect",
    subtitle: "Add soft outer glow",
  });
  settings.bind("glow", glowRow, "active", Gio.SettingsBindFlags.DEFAULT);
  group.add(glowRow);

  // Glow Radius
  const glowRadiusRow = new Adw.SpinRow({
    title: "Glow Radius",
    subtitle: "Blur amount",
    adjustment: new Gtk.Adjustment({
      lower: 0,
      upper: 100,
      step_increment: 1,
      page_increment: 5,
      value: settings.get_int("glow-radius"),
    }),
  });
  settings.bind(
    "glow-radius",
    glowRadiusRow,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );
  settings.bind(
    "glow",
    glowRadiusRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(glowRadiusRow);

  // Glow Spread
  const glowSpreadRow = new Adw.SpinRow({
    title: "Glow Spread",
    subtitle: "Spread amount",
    adjustment: new Gtk.Adjustment({
      lower: 0,
      upper: 50,
      step_increment: 1,
      page_increment: 5,
      value: settings.get_int("glow-spread"),
    }),
  });
  settings.bind(
    "glow-spread",
    glowSpreadRow,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );
  settings.bind(
    "glow",
    glowSpreadRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(glowSpreadRow);

  return group;
}
