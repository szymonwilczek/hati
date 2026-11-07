// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Szymon Wilczek

import GObject from "gi://GObject";

import { GLSLEffect } from "./glsl-effect.js";
import { getShaderDeclarations, getShaderCode } from "./shaders.js";

export const MagnifierClipEffect = GObject.registerClass(
  {},
  class MagnifierClipEffect extends GLSLEffect {
    getSnippetSource() {
      return {
        declarations: getShaderDeclarations("magnifier-clip"),
        code: getShaderCode("magnifier-clip"),
        replace: false,
      };
    }

    updateUniforms(width, height, cornerRadius) {
      const pixelStep = [1.0 / width, 1.0 / height];
      const bounds = [0, 0, width, height];

      this.setUniformFloat("bounds", 4, bounds);
      this.setUniformFloat("clipRadius", 1, [cornerRadius]);
      this.setUniformFloat("pixelStep", 2, pixelStep);
      this.queue_repaint();
    }
  },
);
