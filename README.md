# Hati

**Professional cursor highlighter for GNOME/Wayland**

A Linux equivalent of perfect for presentations, screen recording, and teaching cursor highlighter.

## Features

- **Smooth cursor highlighting** with customizable shapes (circle, squircle, square)
- **Glow effects** and anti-aliased rendering via GLSL shaders
- **Real-time configuration** - all changes apply instantly without restart
- **Zero performance impact** - GPU-accelerated rendering
- **Wayland-native** - direct integration with GNOME Shell compositor

**Coming Soon:**
- Click animations with color-coded feedback
- Auto-hide when cursor is stationary
- Keyboard shortcuts

## Architecture

Hati uses a hybrid design to work around Wayland's security restrictions:

- **GNOME Shell Extension** (JavaScript/GJS): Renders the highlight overlay with access to global cursor position
- **GTK4 Frontend** (Rust/Libadwaita): User-friendly configuration interface
- **GSettings**: Real-time communication between components

## Status

Core functionality ready for testing!

**Completed Phases:**
- Phase 1: Project Foundation
- Phase 2: Extension Core (cursor tracking)
- Phase 3: Visual Excellence (GLSL shader)
- Phase 4: GSettings Integration  
- Phase 5: Rust Frontend Application

**Next Steps:**
- Manual testing on GNOME 48+
- Click animations implementation
- Performance profiling

## Usage

COMING SOON

### Using the Settings App

COMING SOON

### Manual Configuration (via CLI)

COMING SOON

## Development

COMING Soon

## Requirements

- **GNOME Shell** 48+ (48/49)
- **Wayland** (required for compositor access)
- **Rust** 1.75+ (for frontend)
- **GTK4** & **Libadwaita**

## License

GPL-3.0-or-later
