// highlight.glsl - FRAGCOORD RESCUE SHADER
// Uses screen-space coordinates to bypass broken UVs on Wayland/GNOME 49+
// Implements Pre-Multiplied Alpha to fix blending artifacts.

uniform float u_r;              // red component
uniform float u_g;              // green component
uniform float u_b;              // blue component
uniform float u_alpha;          // global opacity
uniform float u_border_weight;  // border thickness (pixels)
uniform float u_glow;           // glow intensity
uniform float u_shape;          // 0=circle, 1=squircle, 2=square
uniform float u_res_x;          // actor width
uniform float u_res_y;          // actor height

// New uniforms for Screen Space rendering
uniform float u_pos_x;          // actor screen x (top-left)
uniform float u_pos_y;          // actor screen y (top-left)
uniform float u_root_height;    // screen height (to flip Y)

// input from vertex shader (ignored but required to avoid link errors)
varying vec2 cogl_tex_coord_in[1];

void main() {
    // 1. Calculate Center of Actor in Screen Space CLUTTER coordinates (0 at Top)
    vec2 center = vec2(u_pos_x + u_res_x * 0.5, u_pos_y + u_res_y * 0.5);

    // 2. Convert gl_FragCoord (0 at Bottom) to Clutter Space (0 at Top)
    // We assume standard GL conventions where Y increases upwards.
    float screenY = u_root_height - gl_FragCoord.y;
    vec2 pixelPos = vec2(gl_FragCoord.x, screenY);

    // 3. Calculate Vector from Center to Current Pixel
    vec2 delta = pixelPos - center;
    
    // 4. Calculate Distance (in pixels) based on shape
    float dist = 0.0;
    
    if (u_shape < 0.5) {
        // Circle
        dist = length(delta);
    } else if (u_shape < 1.5) {
        // Squircle
        float p = 4.0;
        dist = pow(pow(abs(delta.x), p) + pow(abs(delta.y), p), 1.0 / p);
    } else {
        // Square
        dist = max(abs(delta.x), abs(delta.y));
    }
    
    // 5. Render Ring and Glow
    float radiusPixels = u_res_x * 0.5;
    float borderPixels = u_border_weight;
    float innerRadius = radiusPixels - borderPixels;
    
    // Antialiasing (2.0 pixels wide)
    float aa = 2.0;
    
    float outerEdge = smoothstep(radiusPixels, radiusPixels - aa, dist);
    float innerEdge = smoothstep(innerRadius - aa, innerRadius, dist);
    float ringAlpha = outerEdge * innerEdge;
    
    // Glow
    float glowAlpha = 0.0;
    if (u_glow > 0.0) {
        float glowRadius = radiusPixels + (radiusPixels * 0.3); // 30% larger
        float glowFalloff = smoothstep(glowRadius, radiusPixels, dist);
        glowAlpha = glowFalloff * u_glow * 0.5;
    }
    
    float totalAlpha = max(ringAlpha, glowAlpha);
    
    // 6. Output with PRE-MULTIPLIED ALPHA
    float finalAlpha = u_alpha * totalAlpha;
    
    cogl_color_out = vec4(u_r * finalAlpha, u_g * finalAlpha, u_b * finalAlpha, finalAlpha);
}
