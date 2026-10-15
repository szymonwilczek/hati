// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from "gi://GLib";

/**
 * Debug logging is off unless HATI_DEBUG is set (to anything but "0")
 * in the environment of the process running the extension, i.e:
 *   HATI_DEBUG=1 dbus-run-session gnome-shell --devkit
 * Read once at import, so toggling it requires restarting the process.
 */
export const DEBUG = !["", "0"].includes(GLib.getenv("HATI_DEBUG") ?? "");

/**
 * console.log that only runs when debugging is enabled
 * @param {...any} args - Passed through to console.log
 */
export function debugLog(...args) {
  if (DEBUG) console.log(...args);
}
