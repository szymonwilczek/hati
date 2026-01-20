<div align="center">
  <img src="assets/hati_icon.svg" width="150" height="150" alt="Hati Icon">
  <h1>Hati</h1>
  <p><strong>Native cursor highlighter for GNOME Shell on Wayland.</strong></p>

  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square" alt="License">
  </a>
  <a href="https://wayland.freedesktop.org">
    <img src="https://img.shields.io/badge/Platform-Wayland-orange?style=flat-square" alt="Wayland">
  </a>
</div>

<br>

## Overview

**Hati** is a GNOME Shell extension designed to solve a specific problem: demonstrating software on Wayland. Traditional X11 overlay tools often fail or introduce lag on Wayland compositors. Hati integrates directly into the GNOME Shell rendering pipeline using GLSL shaders, ensuring zero latency and perfect frame synchronization.

It provides a highly customizable visual ring around your cursor, essential for:
- **Teaching / Lectures**
- **Screen Recording**
- **Live Demonstrations**
- **Accessibility**

## Features

| Category | Description |
|----------|-------------|
| **Performance** | **Memory:** ~2-3MB. **Render Time:** ~4.7ms/frame. **Zero Copy** tracking. |
| **Visuals** | Dual-ring design (Solid/Dashed), Corner Radius (Squircle/Circle), dynamic Glow effects. |
| **Interaction** | Visual feedback for clicks: **Pulse**, **Ripple**, **Glow Burst**. Distinct Left/Right click colors. |
| **Utilities** | Built-in GPU magnifier. Press `Ctrl` (by default, it's customizable) to instantly zoom into the UI. |
| **Config** | Changes apply instantly. No shell restarts required. Native GTK4 preferences window. |

## Installation

### Method 1: GNOME Extensions Website (coming soon)
*Coming soon to extensions.gnome.org, waiting for approval*

### Method 2: Manual Installation
1. Download the latest release from [Releases](https://github.com/szymonwilczek/hati/releases).
2. Install via CLI:
   ```bash
   gnome-extensions install hati@szymonwilczek.github.io.zip
   ```
3. Restart GNOME Shell (Log out/in on Wayland).
4. Enable the extension:
   ```bash
   gnome-extensions enable hati@szymonwilczek.github.io
   ```

### Method 3: Build from Source

You'll need following dependencies: 
- `make`
- `zip`

```bash
# Clone repository
git clone https://github.com/szymonwilczek/hati.git
cd hati

# Build and install
make install
```

## Configuration

Settings can be accessed via the **Extensions** app or by right-clicking the extension icon if enabled. 

- **Appearance:** Shape (Circle/Square), Size, Colors, Opacity, Border Weight.
- **Behavior:** Auto-hide timeout, Inertia physics sliders.
- **Magnifier:** Zoom level, Activation keys.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[GPL-3.0](LICENSE)
