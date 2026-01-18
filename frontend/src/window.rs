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
        settings.bind("enabled", &enable_row, "active").build();
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
            let (shape, radius) = match row.selected() {
                0 => ("circle", 50),
                1 => ("squircle", 25),
                2 => ("square", 0),
                _ => ("circle", 50),
            };
            settings.set_string("shape", shape).unwrap();
            settings.set_int("corner-radius", radius).unwrap();
        }));
        general_group.add(&shape_row);
        
        // corner radius slider
        let corner_radius_row = adw::SpinRow::builder()
            .title("Corner Radius (%)")
            .subtitle("Deformation level (0=Square, 50=Circle)")
            .adjustment(&gtk4::Adjustment::new(
                settings.int("corner-radius") as f64,
                0.0,
                50.0,
                1.0,
                5.0,
                0.0,
            ))
            .build();
        settings.bind("corner-radius", &corner_radius_row, "value").build();
        general_group.add(&corner_radius_row);

        // rotation slider
        let rotation_row = adw::SpinRow::builder()
            .title("Rotation")
            .subtitle("Rotation angle (degrees)")
            .adjustment(&gtk4::Adjustment::new(
                settings.int("rotation") as f64,
                0.0,
                360.0,
                5.0,
                15.0,
                0.0,
            ))
            .build();
        settings.bind("rotation", &rotation_row, "value").build();
        general_group.add(&rotation_row);

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
        settings.bind("size", &size_row, "value").build();
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
        settings.bind("opacity", &opacity_row, "value").build();
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
        settings.bind("border-weight", &border_weight_row, "value").build();
        border_group.add(&border_weight_row);

        // gap slider
        let gap_row = adw::SpinRow::builder()
            .title("Ring Gap")
            .subtitle("Space between rings")
            .adjustment(&gtk4::Adjustment::new(
                settings.double("gap"),
                0.0,
                20.0,
                0.5,
                1.0,
                0.0,
            ))
            .digits(1)
            .build();
        settings.bind("gap", &gap_row, "value").build();
        border_group.add(&gap_row);

        // glow toggle
        let glow_row = adw::SwitchRow::builder()
            .title("Glow Effect")
            .subtitle("Add soft outer glow")
            .build();
        glow_row.set_active(settings.boolean("glow"));
        settings.bind("glow", &glow_row, "active").build();
        border_group.add(&glow_row);

        // Glow Radius
        let glow_radius_row = adw::SpinRow::builder()
            .title("Glow Radius")
            .subtitle("Blur amount")
            .adjustment(&gtk4::Adjustment::new(
                settings.int("glow-radius") as f64,
                0.0,
                100.0,
                1.0,
                5.0,
                0.0,
            ))
            .build();
        settings.bind("glow-radius", &glow_radius_row, "value").build();
        settings.bind("glow", &glow_radius_row, "sensitive").build();
        border_group.add(&glow_radius_row);

        // Glow Spread
        let glow_spread_row = adw::SpinRow::builder()
            .title("Glow Spread")
            .subtitle("Spread amount")
            .adjustment(&gtk4::Adjustment::new(
                settings.int("glow-spread") as f64,
                0.0,
                50.0,
                1.0,
                5.0,
                0.0,
            ))
            .build();
        settings.bind("glow-spread", &glow_spread_row, "value").build();
        settings.bind("glow", &glow_spread_row, "sensitive").build();
        border_group.add(&glow_spread_row);

        page.add(&border_group);

        let physics_group = adw::PreferencesGroup::builder()
            .title("Physics")
            .build();

        // Inertia Toggle
        let inertia_row = adw::SwitchRow::builder()
            .title("Enable Physics")
            .subtitle("Use inertia and spring dynamics")
            .build();
        inertia_row.set_active(settings.boolean("inertia-enabled"));
        settings.bind("inertia-enabled", &inertia_row, "active").build();
        physics_group.add(&inertia_row);

        // Stiffness
        let stiffness_row = adw::SpinRow::builder()
            .title("Stiffness (Speed)")
            .subtitle("How fast the cursor catches up")
            .adjustment(&gtk4::Adjustment::new(
                settings.double("inertia-stiffness"),
                0.01,
                1.0,
                0.01,
                0.1,
                0.0,
            ))
            .digits(2)
            .build();
        settings.bind("inertia-stiffness", &stiffness_row, "value").build();
        settings.bind("inertia-enabled", &stiffness_row, "sensitive").build();
        physics_group.add(&stiffness_row);

        // Smoothness
        let smoothness_row = adw::SpinRow::builder()
            .title("Smoothness (Friction)")
            .subtitle("Higher = More slippery, Lower = More friction")
            .adjustment(&gtk4::Adjustment::new(
                settings.double("inertia-smoothness"),
                0.1,
                0.99,
                0.01,
                0.1,
                0.0,
            ))
            .digits(2)
            .build();
        settings.bind("inertia-smoothness", &smoothness_row, "value").build();
        settings.bind("inertia-enabled", &smoothness_row, "sensitive").build();
        physics_group.add(&smoothness_row);

        page.add(&physics_group);

        let behavior_group = adw::PreferencesGroup::builder()
            .title("Behavior")
            .build();

        // click animations toggle
        let click_animations_row = adw::SwitchRow::builder()
            .title("Click Animations")
            .subtitle("Show ripple effect when clicking")
            .build();
        click_animations_row.set_active(settings.boolean("click-animations"));
        settings.bind("click-animations", &click_animations_row, "active").build();
        behavior_group.add(&click_animations_row);

        // auto-hide toggle
        let auto_hide_row = adw::SwitchRow::builder()
            .title("Auto-hide")
            .subtitle("Hide when cursor is stationary")
            .build();
        auto_hide_row.set_active(settings.boolean("auto-hide"));
        settings.bind("auto-hide", &auto_hide_row, "active").build();
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
