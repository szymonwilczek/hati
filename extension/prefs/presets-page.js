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
        description: "Save current configuration or import from file",
      });
      this.add(createGroup);

      const entryRow = new Adw.EntryRow({
        title: "Preset Name",
        show_apply_button: true,
      });

      entryRow.connect("apply", async () => {
        const name = entryRow.get_text();
        if (name && name.length > 0) {
          if (await this._manager.savePreset(name)) {
            entryRow.set_text("");
            this._refreshList();
          }
        }
      });

      createGroup.add(entryRow);

      const importRow = new Adw.ActionRow({
        title: "Import from File",
        subtitle: "Load a preset from a JSON file",
        activatable: true,
      });
      importRow.connect("activated", () => {
        this._importPreset();
      });
      importRow.add_suffix(
        new Gtk.Image({
          icon_name: "document-open-symbolic",
        }),
      );
      createGroup.add(importRow);

      this._refreshList();
    }

    _importPreset() {
      const dialog = new Gtk.FileChooserNative({
        title: "Import Preset",
        action: Gtk.FileChooserAction.OPEN,
        accept_label: "Import",
        cancel_label: "Cancel",
        modal: true,
      });

      const filter = new Gtk.FileFilter();
      filter.set_name("JSON Files");
      filter.add_pattern("*.json");
      dialog.add_filter(filter);

      dialog.connect("response", async (d, response_id) => {
        if (response_id === Gtk.ResponseType.ACCEPT) {
          const file = dialog.get_file();

          try {
            file.load_contents_async(null, async (source, result) => {
              try {
                const [success, contents] = source.load_contents_finish(result);

                if (success && contents) {
                  const jsonString = new TextDecoder().decode(contents);
                  const config = JSON.parse(jsonString);

                  let name = file.get_basename();
                  if (name.toLowerCase().endsWith(".json")) {
                    name = name.slice(0, -5);
                  }

                  name = name.replace(/_/g, " ");

                  if (await this._manager.saveExternalPreset(name, config)) {
                    this._refreshList();
                    const toast = new Adw.Toast({
                      title: `Preset '${name}' imported`,
                    });
                    const root = this.get_root();
                    if (root && root.add_toast) root.add_toast(toast);
                  } else {
                    const toast = new Adw.Toast({
                      title: "Failed to save preset",
                    });
                    const root = this.get_root();
                    if (root && root.add_toast) root.add_toast(toast);
                  }
                } else {
                  console.error(
                    "[Hati] Import failed: load_contents_finish returned success=false or empty contents",
                  );
                  const toast = new Adw.Toast({
                    title: "Import failed: Empty or unreadable file",
                  });
                  const root = this.get_root();
                  if (root && root.add_toast) root.add_toast(toast);
                }
              } catch (e) {
                console.error(`[Hati] Import failed with error: ${e}`);
                const toast = new Adw.Toast({
                  title: "Import failed: Invalid file",
                });
                const root = this.get_root();
                if (root && root.add_toast) root.add_toast(toast);
              }
            });
          } catch (e) {
            console.error(e);
          }
        }
        dialog.destroy();
      });

      dialog.show();
    }

    async _refreshList() {
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

      const userPresets = await this._manager.getUserPresets();
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
      applyBtn.connect("clicked", async () => {
        if (await this._manager.applyPreset(name)) {
          const toast = new Adw.Toast({ title: `${name} applied` });
          const root = this.get_root();
          if (root && root.add_toast) root.add_toast(toast);
        }
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
        deleteBtn.connect("clicked", async () => {
          await this._manager.deletePreset(name);
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

      dialog.connect("response", async (d, response_id) => {
        if (response_id === Gtk.ResponseType.ACCEPT) {
          const file = dialog.get_file();
          const path = file.get_path();

          // get config
          let preset = (await this._manager.getUserPresets())[name];
          if (!preset) preset = this._manager.getBuiltInPresets()[name];

          if (preset && path) {
            try {
              const jsonString = JSON.stringify(preset, null, 2);
              file.replace_contents_async(
                jsonString,
                null,
                false,
                Gio.FileCreateFlags.NONE,
                null,
                (source, result) => {
                  try {
                    source.replace_contents_finish(result);
                  } catch (e) {
                    console.error(`Failed to export: ${e}`);
                  }
                },
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
