// highlight.glsl - GLSL Fragment Shader for Hati Cursor Highlight
// renders a smooth, anti-aliased circle/ring with optional glow effect

uniform float u_r;              // red component (0.0 - 1.0)
uniform float u_g;              // green component (0.0 - 1.0)
uniform float u_b;              // blue component (0.0 - 1.0)
uniform float u_alpha;          // alpha component (0.0 - 1.0)
uniform float u_border_weight;  // thickness of the ring border (in pixels)
uniform float u_glow;           // glow intensity (0.0 = no glow, 1.0 = max glow)
uniform float u_shape;          // shape parameter (0=circle, 1=squircle, 2=square)
uniform float u_res_x;          // actor width
uniform float u_res_y;          // actor height

// input from vertex shader
varying vec2 cogl_tex_coord_in[1];

void main() {
    // color and resolution vectors to keep logic cleaner
    vec4 u_color = vec4(u_r, u_g, u_b, u_alpha);
    vec2 u_resolution = vec2(u_res_x, u_res_y);
    
    // normalized coordinates (0.0 to 1.0)
    vec2 uv = cogl_tex_coord_in[0].st;
    
    // center coordinates (-1.0 to 1.0)
    vec2 center = (uv - 0.5) * 2.0;
    
    // from center based on shape
    float dist;
    
    if (u_shape < 0.5) {
        // circle: standard Euclidean distance
        dist = length(center);
    } else if (u_shape < 1.5) {
        // squircle: smooth interpolation between circle and square
        float p = 4.0; // squircle power (4.0 is common)
        dist = pow(pow(abs(center.x), p) + pow(abs(center.y), p), 1.0 / p);
    } else {
        // square: Chebyshev distance
        dist = max(abs(center.x), abs(center.y));
    }
    
    // normalization
    float radius = 1.0;
    
    // ring parameters (normalized to actor size)
    float outerRadius = radius;
    float borderWeightNorm = u_border_weight / (u_resolution.x / 2.0);
    float innerRadius = outerRadius - borderWeightNorm;
    
    // anti-aliasing factor (smooth edge)
    float aa = 2.0 / u_resolution.x;
    
    // ring alpha
    float outerEdge = smoothstep(outerRadius, outerRadius - aa, dist);
    float innerEdge = smoothstep(innerRadius - aa, innerRadius, dist);
    float ringAlpha = outerEdge * innerEdge;
    
    // glow effect
    float glowAlpha = 0.0;
    if (u_glow > 0.0) {
        float glowRadius = outerRadius + 0.15; // extends 15% beyond ring
        float glowFalloff = smoothstep(glowRadius, outerRadius, dist);
        glowAlpha = glowFalloff * u_glow * 0.5; // dimmer than main ring
    }
    
    // ring and glow
    float totalAlpha = max(ringAlpha, glowAlpha);
    
    // color with calculated alpha
    vec4 finalColor = vec4(u_color.rgb, u_color.a * totalAlpha);
    
    // output
    cogl_color_out = finalColor;
}
