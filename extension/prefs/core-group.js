// prefs/core-group.js - Core settings (Enable, Shape, Size, etc.)
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";

export function buildCoreGroup(settings) {
  const group = new Adw.PreferencesGroup({
    title: "Core",
  });

  // Enable toggle
  const enableRow = new Adw.SwitchRow({
    title: "Enable Hati",
    subtitle: "Show cursor highlight",
  });
  settings.bind("enabled", enableRow, "active", Gio.SettingsBindFlags.DEFAULT);
  group.add(enableRow);

  // Shape selector
  const shapeModel = new Gtk.StringList();
  shapeModel.append("Circle");
  shapeModel.append("Squircle");
  shapeModel.append("Square");

  const shapeRow = new Adw.ComboRow({
    title: "Shape",
    subtitle: "Highlight shape",
    model: shapeModel,
  });

  const currentShape = settings.get_string("shape");
  const shapeMap = { circle: 0, squircle: 1, square: 2 };
  shapeRow.set_selected(shapeMap[currentShape] ?? 0);

  shapeRow.connect("notify::selected", () => {
    const shapes = ["circle", "squircle", "square"];
    const radii = [50, 25, 0];
    const idx = shapeRow.get_selected();
    settings.set_string("shape", shapes[idx]);
    settings.set_int("corner-radius", radii[idx]);
  });
  group.add(shapeRow);

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

  // Corner radius
  const cornerRadiusRow = new Adw.SpinRow({
    title: "Corner Radius (%)",
    subtitle: "0 = Square, 50 = Circle",
    adjustment: new Gtk.Adjustment({
      lower: 0,
      upper: 50,
      step_increment: 1,
      page_increment: 5,
      value: settings.get_int("corner-radius"),
    }),
  });
  settings.bind(
    "corner-radius",
    cornerRadiusRow,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(cornerRadiusRow);

  // Rotation
  const rotationRow = new Adw.SpinRow({
    title: "Rotation",
    subtitle: "Angle in degrees",
    adjustment: new Gtk.Adjustment({
      lower: 0,
      upper: 360,
      step_increment: 5,
      page_increment: 15,
      value: settings.get_int("rotation"),
    }),
  });
  settings.bind(
    "rotation",
    rotationRow,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(rotationRow);

  return group;
}
