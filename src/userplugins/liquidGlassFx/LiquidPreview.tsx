/* LiquidGlassFx experimental settings preview; no patches to Discord's live UI. */
import { React } from "@webpack/common";
import type { PointerEvent as ReactPointerEvent } from "react";

import {
    advanceLiquidMotion, liquidAtRest, makeLiquidMotion, makeSpring,
    retargetLiquidMotion, springAtRest, stepSpring
} from "./motion";
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
    const dragRef = React.useRef({ id: -1, startX: 0, moved: false, x: 0, swallowClick: false });
    const dragXRef = React.useRef<number | null>(null);

    const setSwitch = (on: boolean) => {
        checkedRef.current = on;
        setChecked(on);
        wakeRef.current();
    };
    const pick = (index: number) => {
        activeRef.current = index;
        setActive(index);
        wakeRef.current();
    };
    const flip = () => {
        if (dragRef.current.swallowClick) {
            dragRef.current.swallowClick = false;
            return;
        }
        setSwitch(!checkedRef.current);
    };

    // All pointer positions are clamped to the knob travel inside the existing native button.
    const switchRange = () => {
        const toggle = toggleRef.current;
        const stage = stageRef.current;
        if (!toggle || !stage) return null;
        const rect = relativeRect(toggle, stage.getBoundingClientRect());
        return {
            left: rect.x + rect.height / 2 + 3,
            right: rect.x + rect.width - rect.height / 2 - 3,
            stageLeft: stage.getBoundingClientRect().left
        };
    };
    const switchPosition = (clientX: number) => {
        const range = switchRange();
        if (!range) return null;
        return Math.max(range.left, Math.min(range.right, clientX - range.stageLeft));
    };
    const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const x = switchPosition(event.clientX);
        if (x === null) return;
        dragRef.current = { id: event.pointerId, startX: event.clientX, x, moved: false, swallowClick: false };
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is optional */ }
        wakeRef.current();
    };
    const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const drag = dragRef.current;
        if (drag.id !== event.pointerId) return;
        if (!drag.moved && Math.abs(event.clientX - drag.startX) < 4) return;
        const x = switchPosition(event.clientX);
        if (x === null) return;
        drag.moved = true;
        drag.swallowClick = true;
        drag.x = x;
        dragXRef.current = x;
        wakeRef.current();
    };
    const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const drag = dragRef.current;
        if (drag.id !== event.pointerId) return;
        const range = switchRange();
        if (drag.moved && range) {
            const x = switchPosition(event.clientX) ?? drag.x;
            setSwitch(x >= (range.left + range.right) / 2);
        }
        drag.id = -1;
        dragXRef.current = null;
        wakeRef.current();
    };
    const onPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (dragRef.current.id !== event.pointerId) return;
        dragRef.current.id = -1;
        dragRef.current.swallowClick = true;
        dragXRef.current = null;
        wakeRef.current();
    };

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
        let navLiquid = makeLiquidMotion(0);
        let switchLiquid = makeLiquidMotion(0);
        let fill = makeSpring(0);
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        let reduceMotion = media.matches;
        const layout = () => {
            const stageRect = stage.getBoundingClientRect();
            const navRect = relativeRect(nav, stageRect);
            const switchRect = relativeRect(toggle, stageRect);
            const selected = itemRefs.current[activeRef.current];
            if (!selected) return null;
            const selectedRect = relativeRect(selected, stageRect);
            const switchLeft = switchRect.x + switchRect.height / 2 + 3;
            const switchRight = switchRect.x + switchRect.width - switchRect.height / 2 - 3;
            const end = dragXRef.current ?? (checkedRef.current ? switchRight : switchLeft);
            const fillEnd = dragXRef.current ?? (checkedRef.current ? switchRect.x + switchRect.width : switchRect.x);
            const target = selectedRect.x + selectedRect.width / 2;
            if (!initialized) {
                navLiquid = makeLiquidMotion(target);
                switchLiquid = makeLiquidMotion(end);
                fill = makeSpring(fillEnd);
                initialized = true;
            }
            return { navRect, switchRect, selectedRect, end, fillEnd, target };
        };
        const draw = (now: number) => {
            animation = 0;
            if (disposed || !visible || !renderer) return;
            const dimensions = layout();
            if (!dimensions) return;
            const dt = previousTime === 0 ? 0 : Math.min(0.05, (now - previousTime) / 1000);
            previousTime = now;
            if (!reduceMotion) elapsed += dt;
            navLiquid = retargetLiquidMotion(navLiquid, dimensions.target);
            switchLiquid = retargetLiquidMotion(switchLiquid, dimensions.end);
            const navRadius = Math.max(5, (dimensions.selectedRect.height - 8) / 2);
            const knobRadius = Math.max(4, dimensions.switchRect.height / 2 - 4);
            const navY = dimensions.selectedRect.y + dimensions.selectedRect.height / 2;
            const toggleY = dimensions.switchRect.y + dimensions.switchRect.height / 2;
            navLiquid = advanceLiquidMotion(navLiquid, dt, navY, navRadius, reduceMotion);
            switchLiquid = advanceLiquidMotion(switchLiquid, dt, toggleY, knobRadius, reduceMotion);
            fill = stepSpring(fill, dimensions.fillEnd, dt, reduceMotion, 10);
            renderer.render({
                pill: dimensions.navRect,
                selection: {
                    x: navLiquid.head.x - dimensions.selectedRect.width / 2 + SPACING / 2,
                    y: dimensions.selectedRect.y + 4,
                    width: dimensions.selectedRect.width - SPACING,
                    height: dimensions.selectedRect.height - 8
                },
                navTailX: navLiquid.tail.x,
                navDrops: navLiquid.drops,
                navRipples: navLiquid.ripples,
                toggle: dimensions.switchRect,
                knobX: switchLiquid.head.x,
                knobTailX: switchLiquid.tail.x,
                knobRadius,
                knobVelocity: switchLiquid.head.velocity,
                toggleDrops: switchLiquid.drops,
                toggleRipples: switchLiquid.ripples,
                fillX: fill.x,
                intensity: 0.87,
                seconds: reduceMotion ? 0 : elapsed
            });
            if (!liquidAtRest(navLiquid) || !liquidAtRest(switchLiquid) ||
                !springAtRest(fill, dimensions.fillEnd)) {
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
        const onRestored = () => { if (!disposed) create(); };
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
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerCancel}
                    >
                        <span aria-hidden="true" className="lgfx-switch-knob" />
                    </button>
                </div>
                <span aria-hidden="true" className="lgfx-stage-caption">GPU REFRACTION • ORIGINAL GLSL</span>
            </div>
            <p className="lgfx-footnote" role="status">
                {gpuReady
                    ? "WebGL active. Drag or tap the switch, or jump between tabs: water stretches, splits, and merges."
                    : "WebGL unavailable. CSS controls remain interactive; the rest of Discord is unaffected."}
            </p>
        </div>
    );
}
