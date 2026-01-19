// modules/highlight-renderer.js - Cairo highlight drawing logic
// SPDX-License-Identifier: GPL-3.0-or-later

import { getAnimation } from "../animations/animations.js";

/**
 * Draw rounded rectangle path (centered at 0,0)
 * @param {Cairo.Context} cr - Cairo context
 * @param {number} halfW - Half width of rectangle
 * @param {number} cornerR - Corner radius
 */
function drawRoundedRect(cr, halfW, cornerR) {
  const x = -halfW;
  const y = -halfW;
  const w = halfW * 2;
  const h = halfW * 2;
  const r = Math.max(0, cornerR);

  cr.newPath();
  if (r > 0) {
    cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    cr.arc(x + r, y + r, r, Math.PI, (3 * Math.PI) / 2);
  } else {
    cr.rectangle(x, y, w, h);
  }
  cr.closePath();
}

/**
 * Render the highlight on a Cairo context
 * @param {St.DrawingArea} area - Drawing area
 * @param {object} params - Render parameters
 * @param {object} params.drawSettings - Drawing settings
 * @param {object} params.clickState - Click animation state
 * @param {object} params.glow - Glow module instance
 * @param {object} params.settings - GSettings instance
 */
export function renderHighlight(area, params) {
  const { drawSettings, clickState, glow, settings } = params;
  const cr = area.get_context();
  const [width, height] = area.get_surface_size();

  // clear canvas
  cr.save();
  cr.setOperator(0); // CLEAR
  cr.paint();
  cr.restore();

  const {
    size,
    borderWeight,
    color,
    radiusPx,
    rotation,
    gap,
    clickAnimations,
    clickAnimationMode,
  } = drawSettings;

  // animation state calculation
  let animScaleX = 1.0;
  let animScaleY = 1.0;
  let animTranslateX = 0;
  let drawColor = {
    r: color.red / 255,
    g: color.green / 255,
    b: color.blue / 255,
    a: color.alpha,
  }; // default

  if (
    clickAnimations &&
    clickState &&
    (clickState.active || clickState.progress > 0)
  ) {
    const progress = clickState.progress;
    const button = clickState.button; // 'left' or 'right'

    // color blending
    let targetR, targetG, targetB;

    if (button === "right") {
      targetR = drawSettings.rightClickColor.red / 255;
      targetG = drawSettings.rightClickColor.green / 255;
      targetB = drawSettings.rightClickColor.blue / 255;
    } else {
      targetR = drawSettings.leftClickColor.red / 255;
      targetG = drawSettings.leftClickColor.green / 255;
      targetB = drawSettings.leftClickColor.blue / 255;
    }

    // current * (1-p) + target * p
    const blend = Math.min(1.0, progress * 0.8);

    drawColor.r = drawColor.r * (1 - blend) + targetR * blend;
    drawColor.g = drawColor.g * (1 - blend) + targetG * blend;
    drawColor.b = drawColor.b * (1 - blend) + targetB * blend;

    // shape deformation
    const animation = getAnimation(clickAnimationMode, settings);
    const transforms = animation.calculate({ progress, button, size });
    animScaleX = transforms.scaleX;
    animScaleY = transforms.scaleY;
    animTranslateX = transforms.translateX;
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const rotationRad = (rotation || 0) * (Math.PI / 180);

  // transformations
  cr.translate(centerX, centerY);
  // click animation transforms
  cr.translate(animTranslateX, 0);
  cr.scale(animScaleX, animScaleY);
  // shape totation
  cr.rotate(rotationRad);

  // helper wrapper for drawRoundedRect
  const drawRect = (halfW, cornerR) => drawRoundedRect(cr, halfW, cornerR);

  // ring dimensions
  const outerBorderWidth = borderWeight;
  const innerBorderWidth = borderWeight + 1;

  const outerHalf = size / 2;
  const innerHalf = outerHalf - outerBorderWidth - gap - innerBorderWidth / 2;
  const outerRadius = radiusPx;
  const innerRadius = Math.max(0, radiusPx - outerBorderWidth - gap);

  // glow effect (behind everything)
  if (glow) {
    glow.draw(
      cr,
      {
        outerHalf,
        outerRadius,
        outerBorderWidth,
        drawColor,
        width,
        height,
      },
      drawRect,
    );
  }

  // outer ring 
  cr.setSourceRGBA(drawColor.r, drawColor.g, drawColor.b, 1.0);
  cr.setLineWidth(outerBorderWidth);
  drawRect(outerHalf - outerBorderWidth / 2, outerRadius);
  cr.stroke();

  // inner ring 
  const { opacity, dashedBorder, dashGapSize } = drawSettings;
  cr.setSourceRGBA(drawColor.r, drawColor.g, drawColor.b, opacity);
  cr.setLineWidth(innerBorderWidth);

  if (dashedBorder) {
    // calculate perimeter of the inner ring path
    const perimeter = 8 * (innerHalf - innerRadius) + 2 * Math.PI * innerRadius;

    const dashLen = 2.0;
    const targetGap = Math.max(1.5, dashGapSize);
    const targetUnit = dashLen + targetGap;

    // find best fit integer count
    let count = Math.round(perimeter / targetUnit);
    if (count < 4) count = 4;

    // recalculate exact gap to close the loop perfectly
    const actualUnit = perimeter / count;
    const actualGap = actualUnit - dashLen;

    // apply dash
    cr.setDash([dashLen, actualGap], 0);
  }

  drawRect(innerHalf, innerRadius);
  cr.stroke();

  // reset dash just in case
  cr.setDash([], 0);

  // dispose context when done
  cr.$dispose();
}
