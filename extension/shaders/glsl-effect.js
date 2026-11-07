// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Szymon Wilczek

import Clutter from "gi://Clutter";
import Cogl from "gi://Cogl";
import GObject from "gi://GObject";
import Shell from "gi://Shell";

const LegacyGLSLEffect = Shell.GLSLEffect ?? null;

class GLSLEffectImpl extends (LegacyGLSLEffect ?? Clutter.ShaderEffect) {
  /**
   * Subclasses return the fragment snippet source.
   * @returns {{declarations: string, code: string, replace: boolean}}
   */
  getSnippetSource() {
    throw new Error("getSnippetSource() not implemented");
  }

  /**
   * Set a float uniform (scalar or vector) by name on either API.
   * @param {string} name - Uniform name in the shader
   * @param {number} nComponents - Number of components (1-4)
   * @param {number[]} value - Uniform value
   */
  setUniformFloat(name, nComponents, value) {
    if (!LegacyGLSLEffect) {
      this.set_uniform_float(name, nComponents, value);
      return;
    }

    if (!this._uniformLocations) this._uniformLocations = new Map();
    let location = this._uniformLocations.get(name);
    if (location === undefined) {
      location = this.get_uniform_location(name);
      this._uniformLocations.set(name, location);
    }
    this.set_uniform_float(location, nComponents, value);
  }
}

// GJS rejects vfunc overrides missing from the parent class, so only define
// the one matching the running Shell version.
// Plain assignment would hit GJS's vfunc lookup on the prototype
// - hence defineProperty
function buildPipeline() {
  const { declarations, code, replace } = this.getSnippetSource();
  if (!code) return;

  this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, declarations, code, replace);
}

function getStaticSnippet() {
  const { declarations, code, replace } = this.getSnippetSource();
  const snippet = Cogl.Snippet.new(
    Cogl.SnippetHook.FRAGMENT,
    declarations,
    null,
  );
  if (replace) snippet.set_replace(code);
  else snippet.set_post(code);
  return snippet;
}

Object.defineProperty(
  GLSLEffectImpl.prototype,
  LegacyGLSLEffect ? "vfunc_build_pipeline" : "vfunc_get_static_snippet",
  {
    value: LegacyGLSLEffect ? buildPipeline : getStaticSnippet,
    writable: true,
    configurable: true,
  },
);

export const GLSLEffect = GObject.registerClass({}, GLSLEffectImpl);
