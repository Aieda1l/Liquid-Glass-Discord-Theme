/* LiquidGlassFx experimental settings preview; no patches to Discord's live UI. */
import { React } from "@webpack/common";

import { makeSpring, springAtRest, stepSpring } from "./motion";
import { createGlassRenderer, type GlassRenderer, type Rect } from "./rendering";

const LABELS = ["Home", "Discover", "Messages", "Profile"] as const;
const SPACING = 15;

function relativeRect(element: HTMLElement, origin: DOMRect): Rect {
    const rect = element.getBoundingClientRect();
    return { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height };
}

export function LiquidPreview() {
    const [active, setActive] = React.useState(0);
    const [checked, setChecked] = React.useState(false);
    const [gpuReady, setGpuReady] = React.useState(false);
    const stageRef = React.useRef<HTMLDivElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const navRef = React.useRef<HTMLDivElement>(null);
    const toggleRef = React.useRef<HTMLButtonElement>(null);
    const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
    const activeRef = React.useRef(active);
    const checkedRef = React.useRef(checked);
    const wakeRef = React.useRef<() => void>(() => {});

    function pick(index: number) {
        activeRef.current = index;
        setActive(index);
        wakeRef.current();
    }
    function flip() {
        checkedRef.current = !checkedRef.current;
        setChecked(checkedRef.current);
        wakeRef.current();
    }

    React.useEffect(() => {
        const stage = stageRef.current;
        const canvas = canvasRef.current;
        const nav = navRef.current;
        const toggle = toggleRef.current;
        if (!stage || !canvas || !nav || !toggle) return;

        let renderer: GlassRenderer | null = null;
        let animation = 0;
        let previousTime = 0;
        let elapsed = 0;
        let visible = true;
        let disposed = false;
        let initialized = false;
        let selection = makeSpring(0);
        let knob = makeSpring(0);
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        let reduceMotion = media.matches;
        const layout = () => {
            const stageRect = stage.getBoundingClientRect();
            const navRect = relativeRect(nav, stageRect);
            const switchRect = relativeRect(toggle, stageRect);
            const selected = itemRefs.current[activeRef.current];
            if (!selected) return null;
            const selectedRect = relativeRect(selected, stageRect);
            const end = checkedRef.current
                ? switchRect.x + switchRect.width - switchRect.height / 2 - 3
                : switchRect.x + switchRect.height / 2 + 3;
            const target = selectedRect.x + selectedRect.width / 2;
            if (!initialized) {
                selection = makeSpring(target);
                knob = makeSpring(end);
                initialized = true;
            }
            return { stageRect, navRect, switchRect, selectedRect, end, target };
        };
        const draw = (now: number) => {
            animation = 0;
            if (disposed || !visible || !renderer) return;
            const dimensions = layout();
            if (!dimensions) return;
            const dt = previousTime === 0 ? 0 : Math.min(0.05, (now - previousTime) / 1000);
            previousTime = now;
            if (!reduceMotion) elapsed += dt;
            selection = stepSpring(selection, dimensions.target, dt, reduceMotion);
            knob = stepSpring(knob, dimensions.end, dt, reduceMotion);
            renderer.render({
                pill: dimensions.navRect,
                selection: {
                    x: selection.x - dimensions.selectedRect.width / 2 + SPACING / 2,
                    y: dimensions.selectedRect.y + 4,
                    width: dimensions.selectedRect.width - SPACING,
                    height: dimensions.selectedRect.height - 8
                },
                toggle: dimensions.switchRect,
                knobX: knob.x,
                knobRadius: Math.max(1, dimensions.switchRect.height / 2 - 4),
                knobVelocity: knob.velocity,
                intensity: 0.78,
                seconds: reduceMotion ? 0 : elapsed
            });
            if (!springAtRest(selection, dimensions.target) || !springAtRest(knob, dimensions.end)) {
                animation = requestAnimationFrame(draw);
            } else {
                previousTime = 0; // no frame loop while idle
            }
        };
        const wake = () => {
            if (disposed || !visible || !renderer || animation) return;
            animation = requestAnimationFrame(draw);
        };
        const rescale = () => {
            if (!renderer || disposed) return;
            const bounds = stage.getBoundingClientRect();
            renderer.resize(bounds.width, bounds.height, window.devicePixelRatio || 1);
            previousTime = 0;
            wake();
        };
        const create = () => {
            renderer = createGlassRenderer(canvas);
            setGpuReady(Boolean(renderer));
            if (renderer) rescale();
        };
        const onLost = (event: Event) => {
            event.preventDefault();
            cancelAnimationFrame(animation);
            animation = 0;
            renderer?.destroy();
            renderer = null;
            setGpuReady(false);
        };
        const onRestored = () => {
            if (!disposed) create();
        };
        canvas.addEventListener("webglcontextlost", onLost);
        canvas.addEventListener("webglcontextrestored", onRestored);
        create();
        const resizeObserver = new ResizeObserver(rescale);
        resizeObserver.observe(stage);
        const intersectionObserver = new IntersectionObserver(entries => {
            visible = entries[0]?.isIntersecting ?? false;
            if (!visible) {
                cancelAnimationFrame(animation);
                animation = 0;
                previousTime = 0;
            } else wake();
        });
        intersectionObserver.observe(stage);
        const reduceChanged = () => {
            reduceMotion = media.matches;
            if (reduceMotion) elapsed = 0;
            wake();
        };
        media.addEventListener("change", reduceChanged);
        window.addEventListener("resize", rescale);
        wakeRef.current = wake;
        return () => {
            disposed = true;
            wakeRef.current = () => {};
            cancelAnimationFrame(animation);
            resizeObserver.disconnect();
            intersectionObserver.disconnect();
            media.removeEventListener("change", reduceChanged);
            window.removeEventListener("resize", rescale);
            canvas.removeEventListener("webglcontextlost", onLost);
            canvas.removeEventListener("webglcontextrestored", onRestored);
            renderer?.destroy();
        };
    }, []);

    return (
        <div className="lgfx-root">
            <p className="lgfx-description">
                GPU liquid-glass preview. Refraction samples this demo's generated wallpaper only — not Discord messages or windows.
            </p>
            <div ref={stageRef} className="lgfx-stage" data-gpu={gpuReady ? "on" : "off"}>
                <canvas ref={canvasRef} aria-hidden="true" className="lgfx-canvas" />
                <div ref={navRef} className="lgfx-nav" role="group" aria-label="Liquid navigation preview">
                    {LABELS.map((label, index) => (
                        <button
                            key={label}
                            ref={(el: HTMLButtonElement | null) => { itemRefs.current[index] = el; }}
                            className="lgfx-nav-item"
                            data-active={active === index}
                            aria-pressed={active === index}
                            onClick={() => pick(index)}
                            type="button"
                        >{label}</button>
                    ))}
                </div>
                <div className="lgfx-toggle-row">
                    <span>Surface tension</span>
                    <button
                        type="button"
                        ref={toggleRef}
                        className="lgfx-switch"
                        role="switch"
                        aria-label="Surface tension preview"
                        aria-checked={checked}
                        onClick={flip}
                    >
                        <span aria-hidden="true" className="lgfx-switch-knob" />
                    </button>
                </div>
                <span aria-hidden="true" className="lgfx-stage-caption">GPU REFRACTION • ORIGINAL GLSL</span>
            </div>
            <p className="lgfx-footnote" role="status">
                {gpuReady
                    ? "WebGL renderer active. Click a tab or the switch to see the spring motion. Animation stops when settled."
                    : "WebGL unavailable. CSS controls remain interactive; the rest of Discord is unaffected."}
            </p>
        </div>
    );
}
