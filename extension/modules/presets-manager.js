// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from "gi://Gio";
import GLib from "gi://GLib";

export class PresetsManager {
  constructor(settings, schema) {
    this._settings = settings;
    this._keys = [
      "color",
      "rgb-enabled",
      "rgb-speed",
      "size",
      "opacity",
      "border-weight",
      "gap",
      "shape",
      "rotation",
      "corner-radius",
      "glow",
      "glow-radius",
      "glow-spread",
      "dashed-border",
      "dash-gap-size",
      "additional-deformations",
      "use-system-accent",
      "click-animations",
      "click-animation-mode",
      "left-click-color",
      "right-click-color",
      "magnifier-enabled",
      "magnifier-zoom",
      "magnifier-key",
      "auto-hide",
      "auto-hide-delay",
      "inertia-enabled",
      "inertia-stiffness",
      "inertia-smoothness",
      "spotlight-enabled",
      "spotlight-key",
      "spotlight-opacity",
      "spotlight-size",
    ];

    this._configDir = GLib.build_filenamev([
      GLib.get_user_config_dir(),
      "hati",
    ]);
    this._presetsFile = GLib.build_filenamev([this._configDir, "presets.json"]);

    this._ensureConfigDir();
  }

  _ensureConfigDir() {
    const dir = Gio.File.new_for_path(this._configDir);
    if (!dir.query_exists(null)) {
      try {
        dir.make_directory_with_parents(null);
      } catch (e) {
        console.error(
          `[Hati Presets] Failed to create config dir: ${e.message}`,
        );
      }
    }
  }

  getUserPresets() {
    try {
      const file = Gio.File.new_for_path(this._presetsFile);
      if (!file.query_exists(null)) {
        return {};
      }

      const [success, contents] = file.load_contents(null);
      if (!success) return {};

      const jsonString = new TextDecoder().decode(contents);
      return JSON.parse(jsonString);
    } catch (e) {
      console.error(`[Hati Presets] Failed to load user presets: ${e.message}`);
      return {};
    }
  }

  getBuiltInPresets() {
    return this._getDefaultPresets();
  }

  getPresets() {
    return this.getUserPresets();
  }

  savePreset(name) {
    console.log(`[Hati Presets] Saving preset: ${name}`);
    const currentConfig = {};

    this._keys.forEach((key) => {
      const value = this._settings.get_value(key);
      const type = value.get_type_string();

      if (type === "b") currentConfig[key] = value.get_boolean();
      else if (type === "s") currentConfig[key] = value.get_string();
      else if (type === "i") currentConfig[key] = value.get_int32();
      else if (type === "d") currentConfig[key] = value.get_double();
    });

    const presets = this.getPresets();
    presets[name] = currentConfig;

    const success = this._writePresets(presets);
    console.log(`[Hati Presets] Save result: ${success}`);
    return success;
  }

  saveExternalPreset(name, config) {
    if (!config || typeof config !== "object") {
      console.error("[Hati Presets] Invalid config object");
      return false;
    }

    const keys = Object.keys(config);

    if (keys.length === 0) {
      console.warn("[Hati Presets] Warning: Imported configuration is empty.");
    }

    const presets = this.getPresets();
    presets[name] = config;

    return this._writePresets(presets);
  }

  applyPreset(name) {
    console.log(`[Hati Presets] Applying preset: ${name}`);

    let preset = this.getUserPresets()[name];
    if (!preset) {
      preset = this.getBuiltInPresets()[name];
    }

    if (!preset) {
      console.error(`[Hati Presets] Preset not found: ${name}`);
      return false;
    }

    const presetKeys = Object.keys(preset);
    console.log(
      `[Hati Presets] Preset data found. Keys in preset: ${presetKeys.join(", ")}`,
    );

    this._keys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(preset, key)) {
        const val = preset[key];
        action = "SET";
        const defaultVal = this._settings.get_value(key);
        const schemaType = defaultVal.get_type_string();

        try {
          if (schemaType === "b") {
            this._settings.set_boolean(key, Boolean(val));
          } else if (schemaType === "s") {
            this._settings.set_string(key, String(val));
          } else if (schemaType === "i") {
            let intVal = parseInt(val, 10);
            if (isNaN(intVal)) throw new Error(`Invalid integer: ${val}`);
            this._settings.set_int(key, intVal);
          } else if (schemaType === "d") {
            let doubleVal = parseFloat(val);
            if (isNaN(doubleVal)) throw new Error(`Invalid double: ${val}`);
            this._settings.set_double(key, doubleVal);
          } else {
            console.warn(
              `[Hati Presets] Unsupported schema type: ${schemaType} for key ${key}`,
            );
          }
          appliedValue = val;
        } catch (e) {
          console.error(`[Hati Presets] Failed to set ${key}: ${e.message}`);
          action = "ERROR";
        }
      } else {
        this._settings.reset(key);
        action = "RESET";
      }
    });

    return true;
  }

  deletePreset(name) {
    console.log(`[Hati Presets] Deleting preset: ${name}`);
    const presets = this.getPresets();
    if (presets[name]) {
      delete presets[name];
      return this._writePresets(presets);
    }
    return false;
  }

  _writePresets(presets) {
    try {
      this._ensureConfigDir();

      const file = Gio.File.new_for_path(this._presetsFile);
      const jsonString = JSON.stringify(presets, null, 2);
      const [success, tag] = file.replace_contents(
        jsonString,
        null,
        false,
        Gio.FileCreateFlags.NONE,
        null,
      );
      return success;
    } catch (e) {
      console.error(`[Hati Presets] Failed to write presets: ${e.message}`);
      return false;
    }
  }

  _getDefaultPresets() {
    return {
      Default: {
        color: "rgba(144, 238, 144, 1.0)",
        size: 125,
        opacity: 0.7,
        shape: "squircle",
        "rgb-enabled": false,
        "spotlight-enabled": true,
        "border-weight": 4,
        "corner-radius": 40,
        rotation: 45,
        "inertia-enabled": true,
        "inertia-stiffness": 0.65,
        "inertia-smoothness": 0.4,
      },
      Presenter: {
        color: "rgba(255, 165, 0, 1.0)",
        size: 140,
        opacity: 0.8,
        shape: "squircle",
        "corner-radius": 40,
        rotation: 45,
        "rgb-enabled": false,
        "border-weight": 6,
        "inertia-enabled": true,
        "inertia-stiffness": 0.8,
        "inertia-smoothness": 0.4,
      },
      Minimalist: {
        color: "rgba(200, 200, 200, 0.4)",
        size: 80,
        opacity: 0.5,
        shape: "circle",
        "border-weight": 2,
        "dashed-border": true,
        "rgb-enabled": false,
        "inertia-enabled": true,
        "inertia-stiffness": 0.5,
        "inertia-smoothness": 0.6,
      },
      Precision: {
        color: "rgba(0, 255, 255, 1.0)",
        size: 50,
        opacity: 0.9,
        shape: "circle",
        "border-weight": 2,
        gap: 0,
        "dashed-border": false,
        "rgb-enabled": false,
        "inertia-enabled": false,
      },
    };
  }
}
