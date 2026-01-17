// window.rs - Main application window
// SPDX-License-Identifier: GPL-3.0-or-later

use gtk4::prelude::*;
use gtk4::{glib, Application, ColorButton, gio};
use libadwaita as adw;
use adw::prelude::*;
use glib::clone;
use gio::Settings;

pub struct HatiWindow {
    window: adw::ApplicationWindow,
    settings: Settings,
}

impl HatiWindow {
    pub fn new(app: &Application) -> Self {
        // GSettings
        let settings = Settings::new("org.hati.Highlighter");

        let window = adw::ApplicationWindow::builder()
            .application(app)
            .title("Hati Settings")
            .default_width(600)
            .default_height(700)
            .build();

        // UI
        let content = Self::build_content(&settings);
        window.set_content(Some(&content));

        Self { window, settings }
    }

    pub fn present(&self) {
        self.window.present();
    }

    fn build_content(settings: &Settings) -> adw::PreferencesPage {
        let page = adw::PreferencesPage::new();

        // general settings group
        let general_group = adw::PreferencesGroup::builder()
            .title("General")
            .build();

        // enable toggle
        let enable_row = adw::SwitchRow::builder()
            .title("Enable Hati")
            .subtitle("Show cursor highlight")
            .build();
        enable_row.set_active(settings.boolean("enabled"));
        enable_row.connect_active_notify(clone!(@weak settings => move |row| {
            settings.set_boolean("enabled", row.is_active()).unwrap();
        }));
        general_group.add(&enable_row);

        // shape selector
        let shape_row = adw::ComboRow::builder()
            .title("Shape")
            .subtitle("Highlight shape")
            .model(&gtk4::StringList::new(&["Circle", "Squircle", "Square"]))
            .build();

        // set current shape
        let current_shape = settings.string("shape");
        shape_row.set_selected(match current_shape.as_str() {
            "circle" => 0,
            "squircle" => 1,
            "square" => 2,
            _ => 0,
        });

        shape_row.connect_selected_notify(clone!(@weak settings => move |row| {
            let shape = match row.selected() {
                0 => "circle",
                1 => "squircle",
                2 => "square",
                _ => "circle",
            };
            settings.set_string("shape", shape).unwrap();
        }));
        general_group.add(&shape_row);

        page.add(&general_group);

        let appearance_group = adw::PreferencesGroup::builder()
            .title("Appearance")
            .build();

        let color_row = adw::ActionRow::builder()
            .title("Color")
            .subtitle("Highlight color")
            .build();

        let color_button = ColorButton::new();
        let rgba = Self::parse_rgba(&settings.string("color"));
        color_button.set_rgba(&rgba);
        
        color_button.connect_rgba_notify(clone!(@weak settings => move |button| {
            let rgba = button.rgba();
            let color_str = format!(
                "rgba({}, {}, {}, {})",
                (rgba.red() * 255.0) as u8,
                (rgba.green() * 255.0) as u8,
                (rgba.blue() * 255.0) as u8,
                rgba.alpha()
            );
            settings.set_string("color", &color_str).unwrap();
        }));

        color_row.add_suffix(&color_button);
        appearance_group.add(&color_row);

        // size slider
        let size_row = adw::SpinRow::builder()
            .title("Size")
            .subtitle("Highlight diameter")
            .adjustment(&gtk4::Adjustment::new(
                settings.int("size") as f64,
                40.0,
                200.0,
                1.0,
                10.0,
                0.0,
            ))
            .build();
        size_row.connect_changed(clone!(@weak settings => move |row| {
            settings.set_int("size", row.value() as i32).unwrap();
        }));
        appearance_group.add(&size_row);

        // opacity slider
        let opacity_row = adw::SpinRow::builder()
            .title("Opacity")
            .subtitle("Transparency level")
            .adjustment(&gtk4::Adjustment::new(
                settings.double("opacity"),
                0.0,
                1.0,
                0.01,
                0.1,
                0.0,
            ))
            .digits(2)
            .build();
        opacity_row.connect_changed(clone!(@weak settings => move |row| {
            settings.set_double("opacity", row.value()).unwrap();
        }));
        appearance_group.add(&opacity_row);

        page.add(&appearance_group);

        let border_group = adw::PreferencesGroup::builder()
            .title("Border")
            .build();

        // border weight slider
        let border_weight_row = adw::SpinRow::builder()
            .title("Border Weight")
            .subtitle("Ring thickness")
            .adjustment(&gtk4::Adjustment::new(
                settings.int("border-weight") as f64,
                2.0,
                20.0,
                1.0,
                2.0,
                0.0,
            ))
            .build();
        border_weight_row.connect_changed(clone!(@weak settings => move |row| {
            settings.set_int("border-weight", row.value() as i32).unwrap();
        }));
        border_group.add(&border_weight_row);

        // glow toggle
        let glow_row = adw::SwitchRow::builder()
            .title("Glow Effect")
            .subtitle("Add soft outer glow")
            .build();
        glow_row.set_active(settings.boolean("glow"));
        glow_row.connect_active_notify(clone!(@weak settings => move |row| {
            settings.set_boolean("glow", row.is_active()).unwrap();
        }));
        border_group.add(&glow_row);

        page.add(&border_group);

        let behavior_group = adw::PreferencesGroup::builder()
            .title("Behavior")
            .build();

        // click animations toggle
        let click_animations_row = adw::SwitchRow::builder()
            .title("Click Animations")
            .subtitle("Show ripple effect when clicking")
            .build();
        click_animations_row.set_active(settings.boolean("click-animations"));
        click_animations_row.connect_active_notify(clone!(@weak settings => move |row| {
            settings.set_boolean("click-animations", row.is_active()).unwrap();
        }));
        behavior_group.add(&click_animations_row);

        // auto-hide toggle
        let auto_hide_row = adw::SwitchRow::builder()
            .title("Auto-hide")
            .subtitle("Hide when cursor is stationary")
            .build();
        auto_hide_row.set_active(settings.boolean("auto-hide"));
        auto_hide_row.connect_active_notify(clone!(@weak settings => move |row| {
            settings.set_boolean("auto-hide", row.is_active()).unwrap();
        }));
        behavior_group.add(&auto_hide_row);

        page.add(&behavior_group);

        page
    }

    fn parse_rgba(color_str: &str) -> gtk4::gdk::RGBA {
        // "rgba(r, g, b, a)" format
        if let Some(caps) = color_str.strip_prefix("rgba(")
            .and_then(|s| s.strip_suffix(")"))
        {
            let parts: Vec<&str> = caps.split(',').map(|s| s.trim()).collect();
            if parts.len() == 4 {
                let r = parts[0].parse::<u8>().unwrap_or(99) as f32 / 255.0;
                let g = parts[1].parse::<u8>().unwrap_or(162) as f32 / 255.0;
                let b = parts[2].parse::<u8>().unwrap_or(255) as f32 / 255.0;
                let a = parts[3].parse::<f32>().unwrap_or(0.7);
                return gtk4::gdk::RGBA::new(r, g, b, a);
            }
        }

        // default to blue
        gtk4::gdk::RGBA::new(99.0 / 255.0, 162.0 / 255.0, 1.0, 0.7)
    }
}
