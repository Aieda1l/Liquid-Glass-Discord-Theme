/** GPU-only decorative preview: refraction samples our own generated wallpaper, never Discord content. */
import { clampPixelRatio } from "./motion";

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
uniform vec4 uSelection; // active center x/y, width, height
uniform vec4 uToggle;    // switch track center x/y, width, height
uniform vec4 uKnob;      // knob center x/y, radius, spring velocity

float roundRect(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + vec2(radius);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float glassLens(float signedDistance, float depth) {
    float t = clamp(-signedDistance / max(depth, 0.01), 0.0, 1.0);
    return sqrt(max(0.0, 1.0 - (1.0 - t) * (1.0 - t)));
}

float pillDistance(vec2 p) {
    return roundRect(p - uPill.xy, uPill.zw * 0.5, uPill.w * 0.5);
}
float selectionDistance(vec2 p) {
    return roundRect(p - uSelection.xy, uSelection.zw * 0.5, uSelection.w * 0.5);
}
float trackDistance(vec2 p) {
    return roundRect(p - uToggle.xy, uToggle.zw * 0.5, uToggle.w * 0.5);
}
float knobDistance(vec2 p) {
    // Spring velocity stretches the water slightly along the drag axis.
    float stretch = min(abs(uKnob.w) * 0.006, 0.24);
    vec2 q = (p - uKnob.xy) / vec2(1.0 + stretch, 1.0 - stretch * 0.6);
    return (length(q) - uKnob.z) * (1.0 - stretch * 0.5);
}

float heightField(vec2 p) {
    float nav = glassLens(pillDistance(p), 9.0) * 0.9;
    float selected = glassLens(selectionDistance(p), 10.0) * 5.8;
    float track = glassLens(trackDistance(p), 6.0) * 1.5;
    float knob = glassLens(knobDistance(p), 9.0) * 7.5;
    return nav + selected + track + knob;
}

void main() {
    vec2 p = vec2(gl_FragCoord.x, uResolution.y * uPixelRatio - gl_FragCoord.y) / uPixelRatio;
    vec2 uv = clamp(vec2(p.x / uResolution.x, 1.0 - p.y / uResolution.y), vec2(0.0), vec2(1.0));

    float sdNav = pillDistance(p);
    float sdSelection = selectionDistance(p);
    float sdTrack = trackDistance(p);
    float sdKnob = knobDistance(p);
    float mNav = 1.0 - smoothstep(-1.0, 1.0, sdNav);
    float mSelection = 1.0 - smoothstep(-1.0, 1.0, sdSelection);
    float mTrack = 1.0 - smoothstep(-1.0, 1.0, sdTrack);
    float mKnob = 1.0 - smoothstep(-1.0, 1.0, sdKnob);
    float mask = max(max(mNav, mSelection), max(mTrack, mKnob));

    // Finite differences of an original signed-distance height field give real normals.
    vec3 normal = normalize(vec3(
        (heightField(p - vec2(1.0, 0.0)) - heightField(p + vec2(1.0, 0.0))) * 0.45,
        (heightField(p - vec2(0.0, 1.0)) - heightField(p + vec2(0.0, 1.0))) * 0.45,
        1.0
    ));
    vec2 offset = normal.xy * (5.0 + 5.0 * uIntensity) / uResolution;
    offset.y = -offset.y; // texture V increases upward; the height field uses top-left coordinates
    vec3 background = texture2D(uBackdrop, uv).rgb;
    vec3 refracted = texture2D(uBackdrop, clamp(uv + offset, vec2(0.0), vec2(1.0))).rgb;
    // Small chromatic separation adds a glass edge; the RGB samples are intentionally independent.
    float red = texture2D(uBackdrop, clamp(uv + offset * 1.16, vec2(0.0), vec2(1.0))).r;
    float blue = texture2D(uBackdrop, clamp(uv + offset * 0.86, vec2(0.0), vec2(1.0))).b;
    refracted = mix(refracted, vec3(red, refracted.g, blue), 0.24 * uIntensity);

    float fresnel = pow(1.0 - max(normal.z, 0.0), 1.7);
    vec3 light = normalize(vec3(-0.48, -0.74, 0.92));
    float glint = pow(max(dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0)), 0.0), 34.0);
    float rim = 1.0 - smoothstep(0.0, 3.6, -min(min(sdSelection, sdKnob), sdNav));
    float caustic = sin(p.x * 0.095 + p.y * 0.058 - uTime * 2.3) *
                    sin(p.x * 0.038 - p.y * 0.12 + uTime * 1.7);
    vec3 tint = mix(vec3(0.18, 0.14, 0.32), vec3(0.34, 0.27, 0.57), mSelection * 0.58);
    float overlay = (0.14 * mNav + 0.13 * mTrack + 0.17 * mSelection + 0.18 * mKnob);
    vec3 glass = mix(refracted, tint, overlay);
    glass += vec3(0.72, 0.80, 1.0) * (glint * 0.46 + fresnel * 0.32 + rim * 0.13) * uIntensity;
    glass += vec3(0.20, 0.15, 0.36) * caustic * 0.025 * uIntensity * (mSelection + mKnob);
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
            ["uResolution", "uPixelRatio", "uTime", "uIntensity", "uPill", "uSelection", "uToggle", "uKnob"]
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
