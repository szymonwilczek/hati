// main.rs - Hati Cursor Highlighter Settings App
// SPDX-License-Identifier: GPL-3.0-or-later

mod window;

use gtk4::prelude::*;
use gtk4::{glib, Application};
use libadwaita as adw;

const APP_ID: &str = "org.hati.Highlighter";

fn main() -> glib::ExitCode {
    let app = Application::builder().application_id(APP_ID).build();

    app.connect_startup(|_| {
        adw::init().expect("Failed to initialize libadwaita");
    });

    app.connect_activate(build_ui);

    app.run()
}

fn build_ui(app: &Application) {
    let window = window::HatiWindow::new(app);
    window.present();
}
