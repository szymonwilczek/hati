// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Szymon Wilczek

import GObject from "gi://GObject";

import { GLSLEffect } from "./glsl-effect.js";
import { getShaderDeclarations, getShaderCode } from "./shaders.js";

export const SpotlightEffect = GObject.registerClass(
  {},
  class SpotlightEffect extends GLSLEffect {
    getSnippetSource() {
      return {
        declarations: getShaderDeclarations("spotlight"),
        code: getShaderCode("spotlight"),
        replace: true,
      };
    }

    updateUniforms(params) {
      const { x, y, size, opacity, shape, radius, rotation, width, height } =
        params;

      this.setUniformFloat("u_pos", 2, [x, y]);
      this.setUniformFloat("u_size", 1, [size]);
      this.setUniformFloat("u_opacity", 1, [opacity]);
      this.setUniformFloat("u_shape", 1, [shape]);
      this.setUniformFloat("u_radius", 1, [radius]);
      this.setUniformFloat("u_rotation", 1, [rotation]);
      this.setUniformFloat("u_resolution", 2, [width, height]);

      this.queue_repaint();
    }
  },
);
