/** GPU-only decorative preview: refraction samples our own generated wallpaper, never Discord content. */
import { clampPixelRatio, type LiquidDrop, type LiquidRipple } from "./motion";

export const VERTEX_SHADER = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

export const FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D uBackdrop;
uniform vec2 uResolution;
uniform float uPixelRatio;
uniform float uTime;
uniform float uIntensity;
uniform vec4 uPill;      // nav center x/y, width, height
uniform vec4 uSelection; // leading nav lobe center x/y, width, height
uniform vec4 uToggle;    // switch track center x/y, width, height
uniform vec4 uKnob;      // leading switch lobe center x/y, radius, velocity
uniform float uNavTail;
uniform float uKnobTail;
uniform float uFillX;     // spring-following liquid fill boundary
uniform vec4 uDrops[8];  // x, y, radius, group (1 = nav, 2 = switch)
uniform vec4 uRipples[6]; // x, y, age, amplitude

float roundRect(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + vec2(radius);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}
float smoothUnion(float a, float b, float softness) {
    float k = max(0.01, softness);
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}
float glassLens(float signedDistance, float depth) {
    float t = clamp(-signedDistance / max(depth, 0.01), 0.0, 1.0);
    return sqrt(max(0.0, 1.0 - (1.0 - t) * (1.0 - t)));
}
float pillDistance(vec2 p) {
    return roundRect(p - uPill.xy, uPill.zw * 0.5, uPill.w * 0.5);
}
float navLobe(vec2 p, float x, float sizeX, float sizeY) {
    vec2 halfSize = vec2(max(7.0, uSelection.z * sizeX * 0.5), max(6.0, uSelection.w * sizeY * 0.5));
    return roundRect(p - vec2(x, uSelection.y), halfSize, halfSize.y);
}
float selectionDistance(vec2 p) {
    float separation = abs(uSelection.x - uNavTail);
    float thin = clamp(separation / max(20.0, uSelection.z * 0.9), 0.0, 1.0);
    float leading = navLobe(p, uSelection.x, 1.0 - 0.20 * thin, 1.0 - 0.07 * thin);
    float trailing = navLobe(p, uNavTail, 0.76 - 0.43 * thin, 0.93 - 0.33 * thin);
    return smoothUnion(leading, trailing, max(1.0, 12.0 - separation * 0.12));
}
float trackDistance(vec2 p) {
    return roundRect(p - uToggle.xy, uToggle.zw * 0.5, uToggle.w * 0.5);
}
float knobLobe(vec2 p, float center, float radius, float xStretch, float ySquash) {
    vec2 q = (p - vec2(center, uKnob.y)) / vec2(xStretch, ySquash);
    return (length(q) - radius) * min(xStretch, ySquash);
}
float knobDistance(vec2 p) {
    float separation = abs(uKnob.x - uKnobTail);
    float thin = clamp(separation / max(8.0, 2.1 * uKnob.z), 0.0, 1.0);
    float velocityStretch = min(abs(uKnob.w) * 0.0006, 0.16);
    float leading = knobLobe(p, uKnob.x, uKnob.z * (1.0 - 0.04 * thin), 1.0 + velocityStretch, 1.0 - 0.18 * thin);
    float trailing = knobLobe(p, uKnobTail, uKnob.z * (1.0 - 0.28 * thin), 1.0, 1.0 - 0.08 * thin);
    return smoothUnion(leading, trailing, max(0.8, uKnob.z * 0.44 - separation * 0.17));
}
float dropDistance(vec2 p, float group) {
    float d = 1e4;
    for (int i = 0; i < 8; i++) {
        vec4 drop = uDrops[i];
        if (drop.z > 0.5 && abs(drop.w - group) < 0.1) {
            d = min(d, length(p - drop.xy) - drop.z);
        }
    }
    return d;
}
float navLiquidDistance(vec2 p) {
    return max(pillDistance(p) + 1.0, smoothUnion(selectionDistance(p), dropDistance(p, 1.0), 2.4));
}
float switchLiquidDistance(vec2 p) {
    return max(trackDistance(p) + 0.8, smoothUnion(knobDistance(p), dropDistance(p, 2.0), 2.4));
}
float waves(vec2 p) {
    float effect = 0.0;
    for (int i = 0; i < 6; i++) {
        vec4 ripple = uRipples[i];
        if (ripple.w > 0.0) {
            float ring = length(p - ripple.xy) - ripple.z * 145.0;
            effect += ripple.w * exp(-ripple.z * 5.0) * sin(ring * 0.33) * exp(-ring * ring / 650.0);
        }
    }
    return effect;
}
float heightField(vec2 p) {
    float nav = glassLens(pillDistance(p), 9.0) * 0.8;
    float selected = glassLens(navLiquidDistance(p), 12.0) * 7.8;
    float track = glassLens(trackDistance(p), 6.0) * 1.6;
    float knob = glassLens(switchLiquidDistance(p), 10.0) * 9.0;
    float waveMask = 1.0 - smoothstep(-2.0, 3.0, min(pillDistance(p), trackDistance(p)));
    return nav + selected + track + knob + waves(p) * 1.8 * waveMask;
}
void main() {
    vec2 p = vec2(gl_FragCoord.x, uResolution.y * uPixelRatio - gl_FragCoord.y) / uPixelRatio;
    vec2 uv = clamp(vec2(p.x / uResolution.x, 1.0 - p.y / uResolution.y), vec2(0.0), vec2(1.0));
    float sdNav = pillDistance(p);
    float sdSelection = navLiquidDistance(p);
    float sdTrack = trackDistance(p);
    float sdKnob = switchLiquidDistance(p);
    float mNav = 1.0 - smoothstep(-1.0, 1.0, sdNav);
    float mSelection = 1.0 - smoothstep(-1.0, 1.0, sdSelection);
    float mTrack = 1.0 - smoothstep(-1.0, 1.0, sdTrack);
    float mKnob = 1.0 - smoothstep(-1.0, 1.0, sdKnob);
    float mask = max(max(mNav, mSelection), max(mTrack, mKnob));

    vec3 normal = normalize(vec3(
        (heightField(p - vec2(1.0, 0.0)) - heightField(p + vec2(1.0, 0.0))) * 0.48,
        (heightField(p - vec2(0.0, 1.0)) - heightField(p + vec2(0.0, 1.0))) * 0.48,
        1.0
    ));
    vec2 offset = normal.xy * (6.5 + 6.0 * uIntensity) / uResolution;
    offset.y = -offset.y;
    vec3 background = texture2D(uBackdrop, uv).rgb;
    vec3 refracted = texture2D(uBackdrop, clamp(uv + offset, vec2(0.0), vec2(1.0))).rgb;
    float red = texture2D(uBackdrop, clamp(uv + offset * 1.16, vec2(0.0), vec2(1.0))).r;
    float blue = texture2D(uBackdrop, clamp(uv + offset * 0.86, vec2(0.0), vec2(1.0))).b;
    refracted = mix(refracted, vec3(red, refracted.g, blue), 0.24 * uIntensity);

    float fillSurface = max(sdTrack + 2.0, p.x - uFillX + sin(p.y * 0.24 - uTime * 13.0) * 1.2);
    float fill = 1.0 - smoothstep(-1.5, 1.5, fillSurface);
    float fresnel = pow(1.0 - max(normal.z, 0.0), 1.7);
    vec3 light = normalize(vec3(-0.48, -0.74, 0.92));
    float glint = pow(max(dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0)), 0.0), 30.0);
    float rim = 1.0 - smoothstep(0.0, 4.2, -min(min(sdSelection, sdKnob), sdNav));
    float caustic = sin(p.x * 0.095 + p.y * 0.058 - uTime * 2.3) *
                    sin(p.x * 0.038 - p.y * 0.12 + uTime * 1.7);
    vec3 tint = mix(vec3(0.18, 0.14, 0.32), vec3(0.42, 0.31, 0.69), mSelection * 0.58);
    vec3 glass = mix(refracted, tint, 0.14 * mNav + 0.12 * mTrack + 0.24 * mSelection + 0.22 * mKnob);
    vec3 wetFill = mix(vec3(0.18, 0.46, 0.90), vec3(0.54, 0.30, 0.94), 0.48 + 0.18 * sin(p.y * 0.12 - uTime * 1.5));
    glass = mix(glass, wetFill + refracted * 0.23, fill * 0.76 * (1.0 - mKnob * 0.45));
    glass += vec3(0.78, 0.83, 1.0) * (glint * 0.54 + fresnel * 0.46 + rim * 0.18) * uIntensity;
    glass += vec3(0.24, 0.19, 0.41) * caustic * 0.032 * uIntensity * (mSelection + mKnob);
    gl_FragColor = vec4(mix(background, glass, mask), 1.0);
}
`;

export interface Rect { x: number; y: number; width: number; height: number; }
export interface GlassFrame {
    pill: Rect;
    selection: Rect;
    toggle: Rect;
    knobX: number;
    knobRadius: number;
    knobVelocity: number;
    navTailX: number;
    knobTailX: number;
    fillX: number;
    navDrops: LiquidDrop[];
    toggleDrops: LiquidDrop[];
    navRipples: LiquidRipple[];
    toggleRipples: LiquidRipple[];
    intensity: number;
    seconds: number;
}
export interface GlassRenderer {
    resize(width: number, height: number, deviceRatio: number): void;
    render(frame: GlassFrame): void;
    destroy(): void;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("WebGL shader allocation failed");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const reason = gl.getShaderInfoLog(shader) || "unknown error";
        gl.deleteShader(shader);
        throw new Error(`LiquidGlass shader compile: ${reason}`);
    }
    return shader;
}

function buildWallpaper(width: number, height: number): HTMLCanvasElement {
    const image = document.createElement("canvas");
    image.width = Math.max(1, Math.round(width));
    image.height = Math.max(1, Math.round(height));
    const context = image.getContext("2d");
    if (!context) throw new Error("Cannot draw preview background");
    const base = context.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, "#121026");
    base.addColorStop(0.55, "#48307a");
    base.addColorStop(1, "#102b4a");
    context.fillStyle = base;
    context.fillRect(0, 0, width, height);
    for (const [x, y, radius, color] of [
        [0.25, 0.25, 0.45, "rgba(189, 115, 255, .44)"],
        [0.83, 0.72, 0.5, "rgba(43, 190, 244, .39)"],
        [0.58, 0.1, 0.35, "rgba(255, 106, 186, .22)"]
    ] as const) {
        const halo = context.createRadialGradient(width * x, height * y, 0, width * x, height * y, width * radius);
        halo.addColorStop(0, color);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = halo;
        context.fillRect(0, 0, width, height);
    }
    // Sharp lines are deliberately visible through the lens, so the shader's distortion is observable.
    context.lineWidth = 2;
    context.strokeStyle = "rgba(202, 231, 255, .33)";
    for (let x = -height; x < width + height; x += 42) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + height * 0.7, height);
        context.stroke();
    }
    return image;
}

export function createGlassRenderer(canvas: HTMLCanvasElement): GlassRenderer | null {
    let gl: WebGLRenderingContext | null;
    try {
        gl = canvas.getContext("webgl", {
            alpha: false,
            antialias: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false
        });
    } catch {
        return null;
    }
    if (!gl) return null;
    let vertex: WebGLShader | null = null;
    let fragment: WebGLShader | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let texture: WebGLTexture | null = null;
    try {
        vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
        fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        program = gl.createProgram();
        if (!program) throw new Error("WebGL program allocation failed");
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Shader link failed");
        buffer = gl.createBuffer();
        texture = gl.createTexture();
        if (!buffer || !texture) throw new Error("WebGL resource allocation failed");
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const attribute = gl.getAttribLocation(program, "aPosition");
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.uniform1i(gl.getUniformLocation(program, "uBackdrop"), 0);
        const locations = Object.fromEntries(
            ["uResolution", "uPixelRatio", "uTime", "uIntensity", "uPill", "uSelection", "uToggle", "uKnob", "uNavTail", "uKnobTail", "uFillX", "uDrops[0]", "uRipples[0]"]
                .map(name => [name, gl.getUniformLocation(program!, name)])
        ) as Record<string, WebGLUniformLocation | null>;
        let width = 0;
        let height = 0;
        let pixelRatio = 1;
        let disposed = false;
        const rect = (loc: string, r: Rect) => gl.uniform4f(locations[loc], r.x + r.width / 2, r.y + r.height / 2, r.width, r.height);
        const destroy = () => {
            if (disposed) return;
            disposed = true;
            if (texture) gl.deleteTexture(texture);
            if (buffer) gl.deleteBuffer(buffer);
            if (program) gl.deleteProgram(program);
            if (vertex) gl.deleteShader(vertex);
            if (fragment) gl.deleteShader(fragment);
        };
        return {
            resize(nextWidth, nextHeight, deviceRatio) {
                if (disposed) return;
                width = Math.max(1, Math.round(nextWidth));
                height = Math.max(1, Math.round(nextHeight));
                pixelRatio = clampPixelRatio(deviceRatio, width, height);
                canvas.width = Math.max(1, Math.round(width * pixelRatio));
                canvas.height = Math.max(1, Math.round(height * pixelRatio));
                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildWallpaper(width, height));
            },
            render(frame) {
                if (disposed) return;
                gl.useProgram(program);
                gl.uniform2f(locations.uResolution, width, height);
                gl.uniform1f(locations.uPixelRatio, pixelRatio);
                gl.uniform1f(locations.uTime, frame.seconds);
                gl.uniform1f(locations.uIntensity, Math.max(0, Math.min(1, frame.intensity)));
                rect("uPill", frame.pill);
                rect("uSelection", frame.selection);
                rect("uToggle", frame.toggle);
                gl.uniform4f(locations.uKnob, frame.knobX, frame.toggle.y + frame.toggle.height / 2, frame.knobRadius, frame.knobVelocity);
                gl.uniform1f(locations.uNavTail, frame.navTailX);
                gl.uniform1f(locations.uKnobTail, frame.knobTailX);
                gl.uniform1f(locations.uFillX, frame.fillX);
                const drops = new Float32Array(8 * 4);
                const ripples = new Float32Array(6 * 4);
                const placeDrops = (items: LiquidDrop[], start: number, group: number) => {
                    items.slice(0, 4).forEach((drop, index) => {
                        drops.set([drop.x, drop.y, drop.radius, group], (start + index) * 4);
                    });
                };
                placeDrops(frame.navDrops, 0, 1);
                placeDrops(frame.toggleDrops, 4, 2);
                const placeRipples = (items: LiquidRipple[], start: number) => {
                    items.slice(-3).forEach((ripple, index) => {
                        ripples.set([ripple.x, ripple.y, ripple.age, ripple.strength], (start + index) * 4);
                    });
                };
                placeRipples(frame.navRipples, 0);
                placeRipples(frame.toggleRipples, 3);
                gl.uniform4fv(locations["uDrops[0]"], drops);
                gl.uniform4fv(locations["uRipples[0]"], ripples);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
            },
            destroy
        };
    } catch (error) {
        if (texture) gl.deleteTexture(texture);
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        if (vertex) gl.deleteShader(vertex);
        if (fragment) gl.deleteShader(fragment);
        // Failure only disables the optional preview; never interrupt Discord's UI.
        console.warn("LiquidGlassFx: WebGL preview unavailable", error);
        return null;
    }
}
