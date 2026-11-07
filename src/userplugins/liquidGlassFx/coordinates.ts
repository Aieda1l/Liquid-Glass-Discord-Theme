/** Convert viewport-scaled DOM geometry to the unscaled CSS pixels used by WebGL. */
export interface Bounds {
    left: number;
    top: number;
    width: number;
    height: number;
}
export interface CssSize { width: number; height: number; }
export interface LocalRect { x: number; y: number; width: number; height: number; }

function safeScale(renderedSize: number, cssSize: number): number {
    return Number.isFinite(renderedSize) && renderedSize > 0 &&
        Number.isFinite(cssSize) && cssSize > 0 ? renderedSize / cssSize : 1;
}

/** DOMRects include Discord's zoom/transform, but canvas shaders use CSS pixels. */
export function rectInCanvasSpace(target: Bounds, canvas: Bounds, css: CssSize): LocalRect {
    const scaleX = safeScale(canvas.width, css.width);
    const scaleY = safeScale(canvas.height, css.height);
    return {
        x: (target.left - canvas.left) / scaleX,
        y: (target.top - canvas.top) / scaleY,
        width: target.width / scaleX,
        height: target.height / scaleY
    };
}

/** Translate a pointer's viewport position using the same scale as the shader. */
export function xInCanvasSpace(clientX: number, canvas: Bounds, cssWidth: number): number {
    return (clientX - canvas.left) / safeScale(canvas.width, cssWidth);
}
