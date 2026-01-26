// SPDX-License-Identifier: GPL-3.0-or-later

import Cogl from "gi://Cogl";
import GObject from "gi://GObject";
import Shell from "gi://Shell";

import { getShaderDeclarations, getShaderCode } from "./shaders.js";

/**
 * MagnifierClipEffect - GLSL effect for rounded corners clipping
 * Used by the magnifier to clip content to rounded rectangle
 */
export const MagnifierClipEffect = GObject.registerClass(
  {},
  class MagnifierClipEffect extends Shell.GLSLEffect {
    _init() {
      super._init();
      this._boundsLoc = this.get_uniform_location("bounds");
      this._clipRadiusLoc = this.get_uniform_location("clipRadius");
      this._pixelStepLoc = this.get_uniform_location("pixelStep");
      console.log("[Hati] MagnifierClipEffect initialized");
    }

    vfunc_build_pipeline() {
      this.add_glsl_snippet(
        Cogl.SnippetHook.FRAGMENT,
        getShaderDeclarations("magnifier-clip"),
        getShaderCode("magnifier-clip"),
        false,
      );
    }

    updateUniforms(width, height, cornerRadius) {
      const pixelStep = [1.0 / width, 1.0 / height];
      const bounds = [0, 0, width, height];

      this.set_uniform_float(this._boundsLoc, 4, bounds);
      this.set_uniform_float(this._clipRadiusLoc, 1, [cornerRadius]);
      this.set_uniform_float(this._pixelStepLoc, 2, pixelStep);
      this.queue_repaint();

      console.log(
        `[Hati ClipEffect] Updated: ${width}x${height}, radius=${cornerRadius}`,
      );
    }
  },
);
