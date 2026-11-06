/** Shader-only highlights for the selected Discord channel row. No Discord pixels or textures are sampled. */
import { clampPixelRatio, type LiquidDrop, type LiquidRipple } from "./motion";
import { VERTEX_SHADER } from "./rendering";

export const LIVE_FRAGMENT_SHADER = `
precision highp float;
uniform vec2 uResolution;
uniform float uPixelRatio;
uniform float uIntensity;
uniform vec4 uSelection; // x, y, width, height of selected channel row
uniform float uHeadY;
uniform float uTailY;
uniform vec4 uDrops[4]; // x, y, radius, active
uniform vec4 uRipples[3]; // x, y, age, strength
float roundRect(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + vec2(radius);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}
float smoothUnion(float a, float b, float softness) {
    float k = max(0.1, softness);
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}
float bodyDistance(vec2 p) {
    vec2 halfSize = vec2(max(5.0, uSelection.z * 0.5 - 3.0), max(5.0, uSelection.w * 0.5 - 3.0));
    float gap = abs(uHeadY - uTailY);
    float pinch = clamp(gap / max(20.0, uSelection.w * 1.5), 0.0, 1.0);
    float head = roundRect(p - vec2(uSelection.x, uHeadY),
        vec2(halfSize.x * (1.0 - 0.10 * pinch), halfSize.y * (1.0 - 0.06 * pinch)), halfSize.y);
    float tail = roundRect(p - vec2(uSelection.x, uTailY),
        vec2(halfSize.x * (0.80 - 0.22 * pinch), halfSize.y * (0.88 - 0.25 * pinch)), halfSize.y * 0.80);
    float d = smoothUnion(head, tail, max(1.1, 9.0 - gap * 0.06));
    for (int i = 0; i < 4; i++) {
        vec4 droplet = uDrops[i];
        if (droplet.w > 0.5 && droplet.z > 0.5) {
            d = smoothUnion(d, length(p - droplet.xy) - droplet.z, 1.7);
        }
    }
    return d;
}
void main() {
    vec2 p = vec2(gl_FragCoord.x / uPixelRatio,
                  uResolution.y - gl_FragCoord.y / uPixelRatio);
    float d = bodyDistance(p);
    float inside = 1.0 - smoothstep(-1.5, 1.7, d);
    float edge = exp(-pow(d / 2.0, 2.0));
    float dx = bodyDistance(p + vec2(1.1, 0.0)) - bodyDistance(p - vec2(1.1, 0.0));
    float dy = bodyDistance(p + vec2(0.0, 1.1)) - bodyDistance(p - vec2(0.0, 1.1));
    vec3 normal = normalize(vec3(dx, dy, 2.4));
    float highlight = pow(max(dot(normal, normalize(vec3(-0.55,-0.8,1.2))), 0.0), 8.0);
    float ripple = 0.0;
    for (int i = 0; i < 3; i++) {
        vec4 ring = uRipples[i];
        if (ring.w > 0.0) {
            float distance = length(p - ring.xy) - ring.z * 90.0;
            ripple += ring.w * exp(-ring.z * 7.0) * exp(-distance*distance / 180.0);
        }
    }
    float alpha = uIntensity * clamp(inside * (0.12 + 0.10 * highlight) + edge * 0.27 + ripple * 0.10, 0.0, 0.58);
    vec3 tint = mix(vec3(0.37,0.24,0.88), vec3(0.92,0.85,1.0),
                    clamp(0.35 + highlight * 0.65 + edge * 0.45, 0.0, 1.0));
    gl_FragColor = vec4(tint, alpha);
}
`;

export interface LiveFrame {
    selection: { x: number; y: number; width: number; height: number };
    headY: number;
    tailY: number;
    drops: LiquidDrop[];
    ripples: LiquidRipple[];
}
export interface LiveRenderer {
    resize(width: number, height: number, devicePixelRatio: number): void;
    render(frame: LiveFrame): void;
    destroy(): void;
}
function shader(gl: WebGLRenderingContext, kind: number, source: string): WebGLShader {
    const result = gl.createShader(kind);
    if (!result) throw new Error("shader allocation failed");
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(result);
        gl.deleteShader(result);
        throw new Error(error || "shader compilation failed");
    }
    return result;
}

export function createLiveRenderer(canvas: HTMLCanvasElement): LiveRenderer | null {
    let gl: WebGLRenderingContext | null;
    try {
        gl = canvas.getContext("webgl", {
            alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false
        });
    } catch {
        return null;
    }
    if (!gl) return null;
    let vertex: WebGLShader | null = null;
    let fragment: WebGLShader | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    try {
        vertex = shader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
        fragment = shader(gl, gl.FRAGMENT_SHADER, LIVE_FRAGMENT_SHADER);
        program = gl.createProgram();
        if (!program) throw new Error("program allocation failed");
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "link failed");
        buffer = gl.createBuffer();
        if (!buffer) throw new Error("buffer allocation failed");
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.useProgram(program);
        const attribute = gl.getAttribLocation(program, "aPosition");
        if (attribute < 0) throw new Error("missing vertex attribute");
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
        const locations = Object.fromEntries(
            ["uResolution", "uPixelRatio", "uIntensity", "uSelection", "uHeadY", "uTailY", "uDrops[0]", "uRipples[0]"]
                .map(key => [key, gl!.getUniformLocation(program!, key)])
        ) as Record<string, WebGLUniformLocation | null>;
        let width = 1;
        let height = 1;
        let ratio = 1;
        let disposed = false;
        const destroy = () => {
            if (disposed) return;
            disposed = true;
            if (buffer) gl.deleteBuffer(buffer);
            if (program) gl.deleteProgram(program);
            if (vertex) gl.deleteShader(vertex);
            if (fragment) gl.deleteShader(fragment);
        };
        return {
            resize(cssWidth, cssHeight, pixelRatio) {
                if (disposed) return;
                width = Math.max(1, cssWidth);
                height = Math.max(1, cssHeight);
                ratio = clampPixelRatio(pixelRatio, width, height);
                const w = Math.max(1, Math.round(width * ratio));
                const h = Math.max(1, Math.round(height * ratio));
                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w;
                    canvas.height = h;
                }
                gl.viewport(0, 0, canvas.width, canvas.height);
            },
            render(frame) {
                if (disposed) return;
                gl.useProgram(program);
                gl.uniform2f(locations.uResolution, width, height);
                gl.uniform1f(locations.uPixelRatio, ratio);
                gl.uniform1f(locations.uIntensity, 0.9);
                const box = frame.selection;
                gl.uniform4f(locations.uSelection, box.x + box.width / 2, box.y + box.height / 2, box.width, box.height);
                gl.uniform1f(locations.uHeadY, frame.headY);
                gl.uniform1f(locations.uTailY, frame.tailY);
                const drops = new Float32Array(4 * 4);
                frame.drops.slice(0, 4).forEach((drop, index) =>
                    drops.set([drop.y, drop.x, drop.radius, 1], index * 4));
                const ripples = new Float32Array(3 * 4);
                frame.ripples.slice(-3).forEach((ripple, index) =>
                    ripples.set([ripple.y, ripple.x, ripple.age, ripple.strength], index * 4));
                gl.uniform4fv(locations["uDrops[0]"], drops);
                gl.uniform4fv(locations["uRipples[0]"], ripples);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
            },
            destroy
        };
    } catch (error) {
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        if (vertex) gl.deleteShader(vertex);
        if (fragment) gl.deleteShader(fragment);
        console.warn("LiquidGlassFx: live shader unavailable; native channel selection preserved", error);
        return null;
    }
}
