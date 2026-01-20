// prefs.js - Hati Extension Preferences
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from "gi://Adw";
import Gio from "gi://Gio";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// Appearance
import { buildCoreGroup } from "./prefs/core-group.js";
import { buildColorsGroup } from "./prefs/colors-group.js";
import { buildStylingGroup } from "./prefs/styling-group.js";

// Behavior
import { buildPhysicsGroup } from "./prefs/physics-group.js";
import { buildInteractionGroup } from "./prefs/interaction-group.js";
import { buildIdleGroup } from "./prefs/idle-group.js";

// Magnifier
import { buildMagnifierGroup } from "./prefs/magnifier-group.js";

export default class HatiPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings("io.github.szymonwilczek.hati");

    // Appearance
    const appearancePage = new Adw.PreferencesPage({
      title: "Appearance",
      icon_name: "preferences-desktop-appearance-symbolic",
    });
    appearancePage.add(buildCoreGroup(settings));
    appearancePage.add(buildColorsGroup(settings));
    appearancePage.add(buildStylingGroup(settings));
    window.add(appearancePage);

    // Behavior
    const behaviorPage = new Adw.PreferencesPage({
      title: "Behavior",
      icon_name: "preferences-system-symbolic",
    });
    behaviorPage.add(buildPhysicsGroup(settings));
    behaviorPage.add(buildInteractionGroup(settings));
    behaviorPage.add(buildIdleGroup(settings));
    window.add(behaviorPage);

    // Magnifier
    const magnifierPage = new Adw.PreferencesPage({
      title: "Magnifier",
      icon_name: "zoom-in-symbolic",
    });
    magnifierPage.add(buildMagnifierGroup(settings));
    window.add(magnifierPage);
  }
}
