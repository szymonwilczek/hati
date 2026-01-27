float aa = 1.0; // anty-aliasing width
vec2 p = cogl_tex_coord0_in.xy * u_resolution; // current pixel coordinates
float dist = getDist(p);

// dist < 0 -> inside the shape -> hole -> transparent (alpha 0)
// dist > 0 -> outside -> overlay -> u_opacity

float alpha = 0.0;

if (dist < -aa) {
    alpha = 0.0;
} else if (dist > aa) {
    alpha = u_opacity;
} else {
    // edge smoothing
    float t = smoothstep(-aa, aa, dist);
    alpha = mix(0.0, u_opacity, t);
}

cogl_color_out = vec4(0.0, 0.0, 0.0, alpha * cogl_color_in.a);
