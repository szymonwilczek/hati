// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gdk from "gi://Gdk";
import Gio from "gi://Gio";

function parseRgba(colorStr) {
  const rgba = new Gdk.RGBA();
  if (rgba.parse(colorStr)) {
    return rgba;
  }
  rgba.parse("rgba(99, 162, 255, 0.7)");
  return rgba;
}

function rgbaToString(rgba) {
  return `rgba(${Math.round(rgba.red * 255)}, ${Math.round(rgba.green * 255)}, ${Math.round(rgba.blue * 255)}, ${rgba.alpha})`;
}

function createColorButton(settings, settingKey) {
  const dialog = new Gtk.ColorDialog({
    with_alpha: true,
  });

  const button = new Gtk.ColorDialogButton({
    dialog: dialog,
    valign: Gtk.Align.CENTER,
  });

  const rgba = parseRgba(settings.get_string(settingKey));
  button.set_rgba(rgba);

  button.connect("notify::rgba", () => {
    const newRgba = button.get_rgba();
    settings.set_string(settingKey, rgbaToString(newRgba));
  });

  return button;
}

export function buildColorsGroup(settings) {
  const group = new Adw.PreferencesGroup({
    title: "Colors",
  });

  const systemAccentRow = new Adw.SwitchRow({
    title: "Use System Accent Color",
    subtitle: "Sync with desktop accent (GNOME 46+)",
  });
  settings.bind(
    "use-system-accent",
    systemAccentRow,
    "active",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(systemAccentRow);

  const colorRow = new Adw.ActionRow({
    title: "Custom Color",
    subtitle: "Highlight color (if accent disabled)",
  });
  const colorButton = createColorButton(settings, "color");
  colorRow.add_suffix(colorButton);
  group.add(colorRow);

  const rgbRow = new Adw.SwitchRow({
    title: "RGB Mode (Rainbow)",
    subtitle: "Cycle through colors continuously",
  });
  settings.bind("rgb-enabled", rgbRow, "active", Gio.SettingsBindFlags.DEFAULT);
  group.add(rgbRow);

  const rgbSpeedRow = new Adw.SpinRow({
    title: "RGB Speed",
    subtitle: "Speed of color cycling",
    digits: 1,
    adjustment: new Gtk.Adjustment({
      lower: 0.1,
      upper: 10.0,
      step_increment: 0.1,
      page_increment: 1.0,
      value: settings.get_double("rgb-speed"),
    }),
  });
  settings.bind(
    "rgb-speed",
    rgbSpeedRow,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );
  settings.bind(
    "rgb-enabled",
    rgbSpeedRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(rgbSpeedRow);

  const updateSensitivity = () => {
    const rgbEnabled = settings.get_boolean("rgb-enabled");
    const useSystemAccent = settings.get_boolean("use-system-accent");

    systemAccentRow.sensitive = !rgbEnabled;
    colorButton.sensitive = !rgbEnabled && !useSystemAccent;
  };

  settings.connect("changed::rgb-enabled", updateSensitivity);
  settings.connect("changed::use-system-accent", updateSensitivity);
  updateSensitivity();

  const opacityRow = new Adw.SpinRow({
    title: "Opacity",
    subtitle: "Transparency level",
    digits: 2,
    adjustment: new Gtk.Adjustment({
      lower: 0.0,
      upper: 1.0,
      step_increment: 0.01,
      page_increment: 0.1,
      value: settings.get_double("opacity"),
    }),
  });
  settings.bind("opacity", opacityRow, "value", Gio.SettingsBindFlags.DEFAULT);
  group.add(opacityRow);

  return group;
}
