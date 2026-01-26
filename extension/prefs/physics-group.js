// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";

/**
 * Build the Physics preferences group
 * @param {Gio.Settings} settings - Extension settings
 * @returns {Adw.PreferencesGroup}
 */
export function buildPhysicsGroup(settings) {
  const group = new Adw.PreferencesGroup({
    title: "Physics",
  });

  const inertiaRow = new Adw.SwitchRow({
    title: "Enable Physics",
    subtitle: "Use inertia and spring dynamics",
  });
  settings.bind(
    "inertia-enabled",
    inertiaRow,
    "active",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(inertiaRow);

  const stiffnessRow = new Adw.SpinRow({
    title: "Stiffness (Speed)",
    subtitle: "How fast the cursor catches up",
    digits: 2,
    adjustment: new Gtk.Adjustment({
      lower: 0.01,
      upper: 1.0,
      step_increment: 0.01,
      page_increment: 0.1,
      value: settings.get_double("inertia-stiffness"),
    }),
  });
  settings.bind(
    "inertia-stiffness",
    stiffnessRow,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );
  settings.bind(
    "inertia-enabled",
    stiffnessRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(stiffnessRow);

  const smoothnessRow = new Adw.SpinRow({
    title: "Smoothness (Friction)",
    subtitle: "Higher = more slippery, Lower = more friction",
    digits: 2,
    adjustment: new Gtk.Adjustment({
      lower: 0.1,
      upper: 0.99,
      step_increment: 0.01,
      page_increment: 0.1,
      value: settings.get_double("inertia-smoothness"),
    }),
  });
  settings.bind(
    "inertia-smoothness",
    smoothnessRow,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );
  settings.bind(
    "inertia-enabled",
    smoothnessRow,
    "sensitive",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(smoothnessRow);

  return group;
}
