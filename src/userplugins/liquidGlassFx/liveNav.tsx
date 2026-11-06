/** Experimental Stage B: one decorative, pointer-transparent GPU overlay for visible server channel rows. */
import { React } from "@webpack/common";
import { rectInCanvasSpace } from "./coordinates";
import { selectionInViewport } from "./liveGeometry";
import { advanceLiquidMotion, liquidAtRest, makeLiquidMotion, retargetLiquidMotion, type LiquidMotion } from "./motion";
import { createLiveRenderer, type LiveRenderer } from "./liveRenderer";

class ChannelOverlay {
    private readonly canvas: HTMLCanvasElement;
    private readonly rows = new Map<string, HTMLElement>();
    private readonly media = window.matchMedia("(prefers-reduced-motion: reduce)");
    private readonly observer: ResizeObserver;
    private renderer: LiveRenderer | null;
    private selectedId: string | null = null;
    private scrollHost: HTMLElement | null = null;
    private motion: LiquidMotion = makeLiquidMotion(0);
    private initialized = false;
    private snapNext = true;
    private raf = 0;
    private lastTime = 0;
    private disposed = false;

    constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.className = "lgfx-live-overlay";
        this.canvas.setAttribute("aria-hidden", "true");
        this.canvas.setAttribute("role", "presentation");
        this.canvas.style.display = "none";
        document.body.appendChild(this.canvas);
        this.renderer = createLiveRenderer(this.canvas);
        this.observer = new ResizeObserver(() => this.reposition());
        this.canvas.addEventListener("webglcontextlost", this.onContextLost);
        this.canvas.addEventListener("webglcontextrestored", this.onContextRestored);
        // Capturing scroll reaches the selected channel list without watching message DOM mutations.
        document.addEventListener("scroll", this.onScroll, true);
        window.addEventListener("resize", this.reposition);
        window.visualViewport?.addEventListener("resize", this.reposition);
        this.media.addEventListener("change", this.onMotionChange);
    }

    register(id: string, row: HTMLElement) {
        if (this.disposed) return;
        this.rows.set(id, row);
        if (id === this.selectedId) this.schedule();
    }
    unregister(id: string, row: HTMLElement) {
        if (this.rows.get(id) === row) this.rows.delete(id);
        if (id === this.selectedId) this.schedule();
    }
    select(id: string | null | undefined) {
        const next = id || null;
        if (next === this.selectedId) return;
        this.selectedId = next;
        this.schedule();
    }

    private readonly onScroll = () => this.reposition();
    private readonly reposition = () => {
        this.snapNext = true; // scrolling or zooming should never leave the highlight behind its hitbox
        this.schedule();
    };
    private readonly onMotionChange = () => this.schedule();
    private readonly onContextLost = (event: Event) => {
        event.preventDefault();
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.renderer?.destroy();
        this.renderer = null;
        this.canvas.style.display = "none";
    };
    private readonly onContextRestored = () => {
        if (this.disposed) return;
        this.renderer = createLiveRenderer(this.canvas);
        this.snapNext = true;
        this.schedule();
    };
    private hide() {
        this.canvas.style.display = "none";
        this.initialized = false;
        this.lastTime = 0;
    }
    private schedule() {
        if (this.disposed || this.raf || !this.renderer) return;
        this.raf = requestAnimationFrame(this.draw);
    }
    private readonly draw = (now: number) => {
        this.raf = 0;
        if (this.disposed || !this.renderer) return;
        const row = this.selectedId ? this.rows.get(this.selectedId) : undefined;
        if (!row?.isConnected) {
            this.hide();
            return;
        }
        // Only channel lists containing a known row are eligible; never target a generic sidebar.
        const scroll = row.closest<HTMLElement>('[class*="scroller_"]');
        const rowRect = row.getBoundingClientRect();
        const viewport = scroll?.getBoundingClientRect();
        if (!scroll || !viewport || !selectionInViewport(rowRect, viewport)) {
            this.hide();
            return;
        }
        const changedViewport = scroll !== this.scrollHost;
        if (changedViewport) {
            this.scrollHost = scroll;
            this.observer.disconnect();
            this.observer.observe(scroll);
            this.snapNext = true;
        }
        // The fixed canvas is confined to the scroll viewport, not the full Discord window.
        const style = this.canvas.style;
        style.display = "block";
        style.left = `${viewport.left}px`;
        style.top = `${viewport.top}px`;
        style.width = `${viewport.width}px`;
        style.height = `${viewport.height}px`;
        this.renderer.resize(this.canvas.clientWidth, this.canvas.clientHeight, window.devicePixelRatio || 1);
        const selected = rectInCanvasSpace(rowRect, this.canvas.getBoundingClientRect(), {
            width: this.canvas.clientWidth, height: this.canvas.clientHeight
        });
        const target = selected.y + selected.height / 2;
        if (!this.initialized || this.snapNext) {
            this.motion = makeLiquidMotion(target);
            this.initialized = true;
            this.snapNext = false;
            this.lastTime = 0;
        } else {
            this.motion = retargetLiquidMotion(this.motion, target);
        }
        const dt = this.lastTime ? Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000)) : 0;
        this.lastTime = now;
        const centerX = selected.x + selected.width / 2;
        this.motion = advanceLiquidMotion(this.motion, dt, centerX, selected.height * 0.5, this.media.matches);
        this.renderer.render({
            selection: selected,
            headY: this.motion.head.x,
            tailY: this.motion.tail.x,
            drops: this.motion.drops,
            ripples: this.motion.ripples
        });
        if (!liquidAtRest(this.motion)) this.schedule();
        else this.lastTime = 0; // no perpetual frame loop
    };

    destroy() {
        if (this.disposed) return;
        this.disposed = true;
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.observer.disconnect();
        document.removeEventListener("scroll", this.onScroll, true);
        window.removeEventListener("resize", this.reposition);
        window.visualViewport?.removeEventListener("resize", this.reposition);
        this.media.removeEventListener("change", this.onMotionChange);
        this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
        this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
        this.renderer?.destroy();
        this.renderer = null;
        this.rows.clear();
        this.canvas.remove();
    }
}

let liveOverlay: ChannelOverlay | null = null;
const anchorRows = new Map<string, HTMLElement>();

export function startLiveNav(initialChannelId: string | null | undefined) {
    if (!liveOverlay && document.body) {
        liveOverlay = new ChannelOverlay();
        for (const [id, row] of anchorRows) liveOverlay.register(id, row);
    }
    liveOverlay?.select(initialChannelId);
}
export function stopLiveNav() {
    liveOverlay?.destroy();
    liveOverlay = null;
}
export function selectLiveNav(channelId: string | null | undefined) {
    liveOverlay?.select(channelId);
}

/** Anchors are React-owned, zero-size markers; all actual controls remain Discord-owned. */
export function LiveChannelAnchor({ channelId }: { channelId: string; }) {
    const anchor = React.useRef<HTMLSpanElement>(null);
    React.useEffect(() => {
        const node = anchor.current;
        const row = node?.closest<HTMLElement>('[class*="link_"]');
        if (!row || !channelId) return;
        anchorRows.set(channelId, row);
        liveOverlay?.register(channelId, row);
        return () => {
            if (anchorRows.get(channelId) === row) anchorRows.delete(channelId);
            liveOverlay?.unregister(channelId, row);
        };
    }, [channelId]);
    return <span ref={anchor} className="lgfx-channel-anchor" aria-hidden="true" />;
}
