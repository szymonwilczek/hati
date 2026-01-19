vec2 p = cogl_tex_coord0_in.xy / pixelStep;
float alpha = getPointOpacity(p, clipRadius);
cogl_color_out *= alpha;
