import St from "gi://St";
import Gio from "gi://Gio";
import GObject from "gi://GObject"; // Import GObject
import Clutter from "gi://Clutter";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import {
  Extension,
  gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";

const Indicator = GObject.registerClass(
  class Indicator extends PanelMenu.Button {
    constructor(extensionPath, settings, openSettingsCallback) {
      super(0.0, _("Hati Indicator"));
      this._settings = settings;
      this._openSettingsCallback = openSettingsCallback;

      this._hbox = new St.BoxLayout({
        style_class: "panel-status-menu-box",
      });

      const iconPath = extensionPath + "/assets/hati-symbolic.svg";
      const gicon = Gio.icon_new_for_string(iconPath);

      this._icon = new St.Icon({
        gicon: gicon,
        style_class: "system-status-icon",
      });

      this._hbox.add_child(this._icon);
      this.add_child(this._hbox);
      this._buildMenu();
    }

    _buildMenu() {
      // Enable Switch
      this._enableSwitch = new PopupMenu.PopupSwitchMenuItem(
        _("Enable Hati"),
        this._settings.get_boolean("enabled"),
      );
      this._enableSwitch.connect("toggled", (item, state) => {
        this._settings.set_boolean("enabled", state);
      });
      this.menu.addMenuItem(this._enableSwitch);

      this._settingsChangedId = this._settings.connect(
        "changed::enabled",
        () => {
          this._enableSwitch.setToggleState(
            this._settings.get_boolean("enabled"),
          );
        },
      );

      // Separator
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // Settings Button
      this._settingsItem = new PopupMenu.PopupMenuItem(_("Settings"));
      this._settingsItem.connect("activate", () => {
        if (this._openSettingsCallback) {
          this._openSettingsCallback();
        }
      });
      this.menu.addMenuItem(this._settingsItem);
    }

    destroy() {
      if (this._settingsChangedId) {
        this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = null;
      }
      super.destroy();
    }
  },
);

export default Indicator;
