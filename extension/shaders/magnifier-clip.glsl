uniform vec4 bounds;
uniform float clipRadius;
uniform vec2 pixelStep;

float getPointOpacity(vec2 p, float radius) {
    float width = bounds.z;
    float height = bounds.w;
    
    if (radius <= 0.0)
        return 1.0;
    
    float centerLeft = radius;
    float centerRight = width - radius;
    float centerTop = radius;
    float centerBottom = height - radius;
    
    vec2 center;
    
    if (p.x < centerLeft)
        center.x = centerLeft;
    else if (p.x > centerRight)
        center.x = centerRight;
    else
        return 1.0;
    
    if (p.y < centerTop)
        center.y = centerTop;
    else if (p.y > centerBottom)
        center.y = centerBottom;
    else
        return 1.0;
    
    vec2 delta = p - center;
    float distSquared = dot(delta, delta);
    
    float outerRadius = radius + 0.5;
    if (distSquared >= (outerRadius * outerRadius))
        return 0.0;
    
    float innerRadius = radius - 0.5;
    if (distSquared <= (innerRadius * innerRadius))
        return 1.0;
    
    return outerRadius - sqrt(distSquared);
}
