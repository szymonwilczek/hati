// prefs/appearance-group.js - Appearance settings group
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gdk from "gi://Gdk";
import Gio from "gi://Gio";

/**
 * Parse rgba string to Gdk.RGBA
 * @param {string} colorStr - "rgba(r, g, b, a)" format
 * @returns {Gdk.RGBA}
 */
function parseRgba(colorStr) {
  const rgba = new Gdk.RGBA();
  if (rgba.parse(colorStr)) {
    return rgba;
  }
  // fallback blue
  rgba.parse("rgba(99, 162, 255, 0.7)");
  return rgba;
}

/**
 * Convert Gdk.RGBA to string
 * @param {Gdk.RGBA} rgba
 * @returns {string}
 */
function rgbaToString(rgba) {
  return `rgba(${Math.round(rgba.red * 255)}, ${Math.round(rgba.green * 255)}, ${Math.round(rgba.blue * 255)}, ${rgba.alpha})`;
}

/**
 * Create a color button with dialog
 * @param {Gio.Settings} settings
 * @param {string} settingKey
 * @returns {Gtk.ColorDialogButton}
 */
function createColorButton(settings, settingKey) {
  const dialog = new Gtk.ColorDialog({
    with_alpha: true,
  });

  const button = new Gtk.ColorDialogButton({
    dialog: dialog,
    valign: Gtk.Align.CENTER,
  });

  // initial color
  const rgba = parseRgba(settings.get_string(settingKey));
  button.set_rgba(rgba);

  // connect to color changes
  button.connect("notify::rgba", () => {
    const newRgba = button.get_rgba();
    settings.set_string(settingKey, rgbaToString(newRgba));
  });

  return button;
}

/**
 * Build the Appearance preferences group
 * @param {Gio.Settings} settings - Extension settings
 * @returns {Adw.PreferencesGroup}
 */
export function buildAppearanceGroup(settings) {
  const group = new Adw.PreferencesGroup({
    title: "Appearance",
  });

  // System Accent Toggle
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

  // Custom Color
  const colorRow = new Adw.ActionRow({
    title: "Custom Color",
    subtitle: "Highlight color (if accent disabled)",
  });
  const colorButton = createColorButton(settings, "color");
  settings.bind(
    "use-system-accent",
    colorButton,
    "sensitive",
    Gio.SettingsBindFlags.INVERT_BOOLEAN,
  );
  colorRow.add_suffix(colorButton);
  group.add(colorRow);

  // Left Click Color
  const leftClickRow = new Adw.ActionRow({
    title: "Left Click Color",
    subtitle: "Animation color for left mouse button",
  });
  const leftColorButton = createColorButton(settings, "left-click-color");
  leftClickRow.add_suffix(leftColorButton);
  group.add(leftClickRow);

  // Right Click Color
  const rightClickRow = new Adw.ActionRow({
    title: "Right Click Color",
    subtitle: "Animation color for right mouse button",
  });
  const rightColorButton = createColorButton(settings, "right-click-color");
  rightClickRow.add_suffix(rightColorButton);
  group.add(rightClickRow);

  // Size
  const sizeRow = new Adw.SpinRow({
    title: "Size",
    subtitle: "Highlight diameter",
    adjustment: new Gtk.Adjustment({
      lower: 40,
      upper: 200,
      step_increment: 1,
      page_increment: 10,
      value: settings.get_int("size"),
    }),
  });
  settings.bind("size", sizeRow, "value", Gio.SettingsBindFlags.DEFAULT);
  group.add(sizeRow);

  // Opacity
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
