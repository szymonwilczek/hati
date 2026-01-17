// DEBUG PROBE SHADER
// Diagnose Pipeline, Uniforms, and Coordinate System

uniform float u_r;              
uniform float u_g;              
uniform float u_b;              
uniform float u_alpha;          
uniform float u_border_weight;  
uniform float u_glow;           
uniform float u_shape;          
uniform float u_res_x;          
uniform float u_res_y;          

uniform float u_pos_x;          
uniform float u_pos_y;          
uniform float u_root_height;    

varying vec2 cogl_tex_coord_in[1];

void main() {
    // 1. Uniform Integrity Check
    if (u_root_height < 100.0) {
         cogl_color_out = vec4(0.0, 0.0, 1.0, 1.0); // BLUE: Height Uniform Missing/Zero
         return;
    }
    
    // 2. Coordinate System Logic
    // Convert gl_FragCoord (Bottom-Left) to Clutter (Top-Left)
    float screenY = u_root_height - gl_FragCoord.y;
    vec2 pixelPos = vec2(gl_FragCoord.x, screenY);
    
    // Actor Center (Screen Space)
    vec2 center = vec2(u_pos_x + u_res_x * 0.5, u_pos_y + u_res_y * 0.5);
    
    // Distance
    float dist = length(pixelPos - center);
    float radius = u_res_x * 0.5;

    // 3. Output Logic
    if (dist <= radius) {
        // PERFECTION: Inside the intended circle
        cogl_color_out = vec4(0.0, 1.0, 0.0, 1.0); // GREEN
    } else {
        // OUTSIDE: Math is working (we have distance), but pixel is outside radius?
        // Note: The shader is CLIPPED to the Actor's box (St.Bin).
        // If dist > radius, it means we are in the corners of the box.
        // We should see RED corners.
        
        // However, if dist is HUGE (coordinate mismatch), the whole box will be RED.
        
        // Debug Gradient in corners to see direction
        float grad = dist / 100.0;
        cogl_color_out = vec4(1.0, grad, 0.0, 1.0); // RED-ish
    }
}
