uniform vec2 u_pos;
uniform float u_size;
uniform float u_opacity;
uniform float u_shape; // 0.0=circle, 1.0=squircle, 2.0=square
uniform float u_radius; // corner radius
uniform float u_rotation; // degrees
uniform vec2 u_resolution;

vec2 rotate(vec2 v, float a) {
    float s = sin(a);
    float c = cos(a);
    mat2 m = mat2(c, -s, s, c);
    return m * v;
}

float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdRoundedBox(vec2 p, vec2 b, float r) {
    return length(max(abs(p)-b+r,0.0))-r;
}

float getDist(vec2 p) {
    vec2 localP = p - u_pos;
    
    // rotate
    float rad = radians(u_rotation);
    localP = rotate(localP, -rad); 
    
    float halfSize = u_size / 2.0;
    
    if (u_shape < 0.5) { // circle
        return length(localP) - halfSize;
    } else if (u_shape > 1.5) { // square
        return sdBox(localP, vec2(halfSize));
    } else { // squircle 
        return sdRoundedBox(localP, vec2(halfSize), u_radius);
    }
}
