// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from "gi://Gio";

let _shaderCache = {};
let _loadedShaders = {};

/**
 * Load a shader file from the shaders directory asynchronously
 * @param {string} extensionPath - Path to the extension
 * @param {string} filename - Shader filename
 * @returns {Promise<string>} - Shader content or empty string on failure
 */
function loadShaderAsync(extensionPath, filename) {
  return new Promise((resolve) => {
    const cacheKey = `${extensionPath}/${filename}`;

    // return cached if available
    if (_shaderCache[cacheKey]) {
      resolve(_shaderCache[cacheKey]);
      return;
    }

    try {
      const file = Gio.File.new_for_path(
        `${extensionPath}/shaders/${filename}`,
      );
      file.load_contents_async(null, (file, result) => {
        try {
          const [success, contents] = file.load_contents_finish(result);

          if (success) {
            const content = new TextDecoder().decode(contents);
            _shaderCache[cacheKey] = content;
            resolve(content);
          } else {
            console.error(`[Hati Shaders] Failed to load: ${filename}`);
            resolve("");
          }
        } catch (e) {
          console.error(`[Hati Shaders] Error loading ${filename}: ${e}`);
          resolve("");
        }
      });
    } catch (e) {
      console.error(`[Hati Shaders] Error loading ${filename}: ${e}`);
      resolve("");
    }
  });
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
 * @returns {Promise<void>}
 */
export async function initShaders(extensionPath) {
  const [magnifierDecl, magnifierCode, spotlightDecl, spotlightCode] =
    await Promise.all([
      loadShaderAsync(extensionPath, "magnifier-clip.glsl"),
      loadShaderAsync(extensionPath, "magnifier-clip.frag"),
      loadShaderAsync(extensionPath, "spotlight.glsl"),
      loadShaderAsync(extensionPath, "spotlight.frag"),
    ]);

  _loadedShaders["magnifier-clip"] = {
    declarations: magnifierDecl,
    code: magnifierCode,
  };

  _loadedShaders["spotlight"] = {
    declarations: spotlightDecl,
    code: spotlightCode,
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
