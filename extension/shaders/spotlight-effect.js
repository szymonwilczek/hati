// SPDX-License-Identifier: GPL-3.0-or-later

import Cogl from "gi://Cogl";
import GObject from "gi://GObject";
import Shell from "gi://Shell";

import { getShaderDeclarations, getShaderCode } from "./shaders.js";

export const SpotlightEffect = GObject.registerClass(
  {},
  class SpotlightEffect extends Shell.GLSLEffect {
    _init() {
      super._init();
      this._posLoc = this.get_uniform_location("u_pos");
      this._sizeLoc = this.get_uniform_location("u_size");
      this._opacityLoc = this.get_uniform_location("u_opacity");
      this._shapeLoc = this.get_uniform_location("u_shape");
      this._radiusLoc = this.get_uniform_location("u_radius");
      this._rotationLoc = this.get_uniform_location("u_rotation");
      this._resolutionLoc = this.get_uniform_location("u_resolution");
    }

    vfunc_build_pipeline() {
      const decl = getShaderDeclarations("spotlight");
      const code = getShaderCode("spotlight");

      if (decl && code) {
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, decl, code, true);
      }
    }

    updateUniforms(params) {
      const { x, y, size, opacity, shape, radius, rotation, width, height } =
        params;

      this.set_uniform_float(this._posLoc, 2, [x, y]);
      this.set_uniform_float(this._sizeLoc, 1, [size]);
      this.set_uniform_float(this._opacityLoc, 1, [opacity]);
      this.set_uniform_float(this._shapeLoc, 1, [shape]);
      this.set_uniform_float(this._radiusLoc, 1, [radius]);
      this.set_uniform_float(this._rotationLoc, 1, [rotation]);
      this.set_uniform_float(this._resolutionLoc, 2, [width, height]);

      this.queue_repaint();
    }
  },
);
