// prefs.js - Hati Extension Preferences
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from "gi://Adw";
import Gio from "gi://Gio";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import { buildGeneralGroup } from "./prefs/general-group.js";
import { buildAppearanceGroup } from "./prefs/appearance-group.js";
import { buildBorderGroup } from "./prefs/border-group.js";
import { buildMagnifierGroup } from "./prefs/magnifier-group.js";
import { buildPhysicsGroup } from "./prefs/physics-group.js";
import { buildBehaviorGroup } from "./prefs/behavior-group.js";

export default class HatiPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings("org.hati.Highlighter");

    const page = new Adw.PreferencesPage({
      title: "Hati",
      icon_name: "preferences-system-symbolic",
    });

    // groups
    page.add(buildGeneralGroup(settings));
    page.add(buildAppearanceGroup(settings));
    page.add(buildBorderGroup(settings));
    page.add(buildMagnifierGroup(settings));
    page.add(buildPhysicsGroup(settings));
    page.add(buildBehaviorGroup(settings));

    window.add(page);
  }
}
