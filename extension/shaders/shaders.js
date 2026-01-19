// shaders/shaders.js - Shader utilities
// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from "gi://Gio";

let _shaderCache = {};
let _loadedShaders = {};

/**
 * Load a shader file from the shaders directory
 * @param {string} extensionPath - Path to the extension
 * @param {string} filename - Shader filename
 * @returns {string} - Shader content or empty string on failure
 */
export function loadShader(extensionPath, filename) {
  const cacheKey = `${extensionPath}/${filename}`;

  // return cached if available
  if (_shaderCache[cacheKey]) {
    return _shaderCache[cacheKey];
  }

  try {
    const file = Gio.File.new_for_path(`${extensionPath}/shaders/${filename}`);
    const [success, contents] = file.load_contents(null);

    if (success) {
      const content = new TextDecoder().decode(contents);
      _shaderCache[cacheKey] = content;
      return content;
    }

    console.error(`[Hati Shaders] Failed to load: ${filename}`);
    return "";
  } catch (e) {
    console.error(`[Hati Shaders] Error loading ${filename}: ${e}`);
    return "";
  }
}

/**
 * Clear shader cache (useful for reloading)
 */
export function clearShaderCache() {
  _shaderCache = {};
  _loadedShaders = {};
}

/**
 * Initialize shaders - must be called before creating effects
 * @param {string} extensionPath - Path to the extension
 */
export function initShaders(extensionPath) {
  _loadedShaders["magnifier-clip"] = {
    declarations: loadShader(extensionPath, "magnifier-clip.glsl"),
    code: loadShader(extensionPath, "magnifier-clip.frag"),
  };

  console.log("[Hati Shaders] All shaders initialized");
}

/**
 * Get shader declarations by name
 * @param {string} shaderName - Shader name
 * @returns {string} - Shader declarations
 */
export function getShaderDeclarations(shaderName) {
  const shader = _loadedShaders[shaderName];
  if (!shader) {
    console.error(`[Hati Shaders] Shader not found: ${shaderName}`);
    return "";
  }
  return shader.declarations;
}

/**
 * Get shader code by name
 * @param {string} shaderName - Shader name
 * @returns {string} - Shader code
 */
export function getShaderCode(shaderName) {
  const shader = _loadedShaders[shaderName];
  if (!shader) {
    console.error(`[Hati Shaders] Shader not found: ${shaderName}`);
    return "";
  }
  return shader.code;
}
