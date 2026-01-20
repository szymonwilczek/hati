// prefs/interaction-group.js - Click interaction settings
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
  rgba.parse("rgba(0, 0, 255, 1)");
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

export function buildInteractionGroup(settings) {
  const group = new Adw.PreferencesGroup({
    title: "Interaction",
  });

  // Click Animations Toggle
  const clickAnimationsRow = new Adw.SwitchRow({
    title: "Click Animations",
    subtitle: "Show effect when clicking",
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
  modeModel.append("Pulse");
  modeModel.append("Glow Burst");
  modeModel.append("Ring Expand");

  const modeRow = new Adw.ComboRow({
    title: "Animation Mode",
    subtitle: "Style of click effect",
    model: modeModel,
  });

  const modes = ["directional", "ripple", "pulse", "glow-burst", "ring-expand"];
  const currentMode = settings.get_string("click-animation-mode");
  const modeIndex = modes.indexOf(currentMode);
  modeRow.set_selected(modeIndex >= 0 ? modeIndex : 0);

  modeRow.connect("notify::selected", () => {
    const idx = modeRow.get_selected();
    if (idx < modes.length) {
      settings.set_string("click-animation-mode", modes[idx]);
    }
  });

  settings.bind(
    "click-animations",
    modeRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(modeRow);

  // Left Click Color
  const leftClickRow = new Adw.ActionRow({
    title: "Left Click Color",
    subtitle: "Animation color for left button",
  });
  const leftColorButton = createColorButton(settings, "left-click-color");
  settings.bind(
    "click-animations",
    leftColorButton,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  leftClickRow.add_suffix(leftColorButton);
  group.add(leftClickRow);

  // Right Click Color
  const rightClickRow = new Adw.ActionRow({
    title: "Right Click Color",
    subtitle: "Animation color for right button",
  });
  const rightColorButton = createColorButton(settings, "right-click-color");
  settings.bind(
    "click-animations",
    rightColorButton,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  rightClickRow.add_suffix(rightColorButton);
  group.add(rightClickRow);

  return group;
}
