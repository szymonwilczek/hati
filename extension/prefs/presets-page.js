// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GObject from "gi://GObject";

import { PresetsManager } from "../modules/presets-manager.js";

export const PresetsPage = GObject.registerClass(
  {
    GTypeName: "HatiPresetsPage",
  },
  class PresetsPage extends Adw.PreferencesPage {
    constructor(settings) {
      super({
        title: "Presets",
        icon_name: "document-save-symbolic",
      });

      this._settings = settings;
      this._manager = new PresetsManager(settings);

      this._buildUI();
    }

    _buildUI() {
      const createGroup = new Adw.PreferencesGroup({
        title: "Create Preset",
        description: "Save current configuration as a new preset",
      });
      this.add(createGroup);

      const entryRow = new Adw.EntryRow({
        title: "Preset Name",
        show_apply_button: true,
      });

      entryRow.connect("apply", () => {
        const name = entryRow.get_text();
        if (name && name.length > 0) {
          if (this._manager.savePreset(name)) {
            entryRow.set_text("");
            this._refreshList();
          }
        }
      });

      createGroup.add(entryRow);

      this._refreshList();
    }

    _refreshList() {
      if (this._builtInGroup) this.remove(this._builtInGroup);
      if (this._userPresetsGroup) this.remove(this._userPresetsGroup);

      this._builtInGroup = new Adw.PreferencesGroup({
        title: "Hati Collections",
        description: "Built-in presets",
      });
      this.add(this._builtInGroup);

      const builtIn = this._manager.getBuiltInPresets();
      Object.keys(builtIn).forEach((name) => {
        this._builtInGroup.add(this._createPresetRow(name, false));
      });

      this._userPresetsGroup = new Adw.PreferencesGroup({
        title: "My Presets",
        description: "User defined presets",
      });
      this.add(this._userPresetsGroup);

      const userPresets = this._manager.getUserPresets();
      const userNames = Object.keys(userPresets).sort();

      if (userNames.length === 0) {
        const emptyRow = new Adw.ActionRow({
          title: "No user presets saved",
          sensitive: false,
        });
        this._userPresetsGroup.add(emptyRow);
      } else {
        userNames.forEach((name) => {
          this._userPresetsGroup.add(this._createPresetRow(name, true));
        });
      }
    }

    _createPresetRow(name, isUserPreset) {
      const row = new Adw.ActionRow({
        title: name,
      });

      const applyBtn = new Gtk.Button({
        icon_name: "object-select-symbolic",
        valign: Gtk.Align.CENTER,
        tooltip_text: "Apply Preset",
      });
      applyBtn.add_css_class("flat");
      applyBtn.add_css_class("suggested-action");
      applyBtn.connect("clicked", () => {
        this._manager.applyPreset(name);
      });
      row.add_suffix(applyBtn);

      const exportBtn = new Gtk.Button({
        icon_name: "document-save-as-symbolic",
        valign: Gtk.Align.CENTER,
        tooltip_text: "Export to File",
      });
      exportBtn.add_css_class("flat");
      exportBtn.connect("clicked", () => {
        this._exportPreset(name);
      });
      row.add_suffix(exportBtn);

      if (isUserPreset) {
        const deleteBtn = new Gtk.Button({
          icon_name: "user-trash-symbolic",
          valign: Gtk.Align.CENTER,
          tooltip_text: "Delete Preset",
        });
        deleteBtn.add_css_class("flat");
        deleteBtn.add_css_class("error");
        deleteBtn.connect("clicked", () => {
          this._manager.deletePreset(name);
          this._refreshList();
        });
        row.add_suffix(deleteBtn);
      }

      return row;
    }

    _exportPreset(name) {
      const dialog = new Gtk.FileChooserNative({
        title: "Export Preset",
        action: Gtk.FileChooserAction.SAVE,
        accept_label: "Save",
        cancel_label: "Cancel",
        modal: true,
      });

      dialog.set_current_name(
        `${name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.json`,
      );

      dialog.connect("response", (d, response_id) => {
        if (response_id === Gtk.ResponseType.ACCEPT) {
          const file = dialog.get_file();
          const path = file.get_path();

          // get config
          let preset = this._manager.getUserPresets()[name];
          if (!preset) preset = this._manager.getBuiltInPresets()[name];

          if (preset && path) {
            try {
              const jsonString = JSON.stringify(preset, null, 2);
              file.replace_contents(
                jsonString,
                null,
                false,
                Gio.FileCreateFlags.NONE,
                null,
              );
            } catch (e) {
              console.error(`Failed to export: ${e}`);
            }
          }
        }
        dialog.destroy();
      });

      dialog.show();
    }
  },
);
