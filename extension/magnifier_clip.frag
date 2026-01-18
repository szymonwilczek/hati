// Magnifier Rounded Corners Clip Shader
// Based on Mutter's rounding shader and rounded-window-corners extension

// Uniforms passed from JavaScript
uniform vec4 bounds;      // x=0, y=0, z=width, w=height
uniform float clipRadius; // corner radius in pixels
uniform vec2 pixelStep;   // 1/width, 1/height

// Calculate if a point is inside the rounded rectangle
// Returns 0.0 for outside, 1.0 for inside, with smooth transition for antialiasing
float getPointOpacity(vec2 p, float radius) {
    float width = bounds.z;
    float height = bounds.w;
    
    // Quick check: if no radius, everything is visible
    if (radius <= 0.0)
        return 1.0;
    
    // Calculate the center points for corner arcs
    float centerLeft = radius;
    float centerRight = width - radius;
    float centerTop = radius;
    float centerBottom = height - radius;
    
    vec2 center;
    
    // Check if point is in a corner region (horizontal)
    if (p.x < centerLeft)
        center.x = centerLeft;
    else if (p.x > centerRight)
        center.x = centerRight;
    else
        return 1.0; // Not in corner region
    
    // Check if point is in a corner region (vertical)
    if (p.y < centerTop)
        center.y = centerTop;
    else if (p.y > centerBottom)
        center.y = centerBottom;
    else
        return 1.0; // Not in corner region
    
    // Point is in a corner - calculate distance from arc center
    vec2 delta = p - center;
    float distSquared = dot(delta, delta);
    
    // Outside the arc completely
    float outerRadius = radius + 0.5;
    if (distSquared >= (outerRadius * outerRadius))
        return 0.0;
    
    // Inside the arc completely
    float innerRadius = radius - 0.5;
    if (distSquared <= (innerRadius * innerRadius))
        return 1.0;
    
    // On the edge - apply antialiasing
    return outerRadius - sqrt(distSquared);
}

void main() {
    // Convert texture coordinates to pixel coordinates
    vec2 p = cogl_tex_coord0_in.xy / pixelStep;
    
    // Calculate opacity
    float alpha = getPointOpacity(p, clipRadius);
    
    // Apply opacity to output color
    cogl_color_out *= alpha;
}
