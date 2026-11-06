/** Motion functions kept independent of Discord and React so they can be tested. */
export interface Spring {
    x: number;
    velocity: number;
}

export function makeSpring(x: number): Spring {
    return { x, velocity: 0 };
}

/** Exact critically damped spring step; `frequency` is radians per second. */
export function stepSpring(
    state: Spring,
    target: number,
    dt: number,
    reduceMotion = false,
    frequency = 16
): Spring {
    if (reduceMotion) return makeSpring(target);
    if (!Number.isFinite(dt) || dt <= 0) return state;
    if (springAtRest(state, target)) return makeSpring(target);

    const seconds = Math.min(dt, 0.05);
    const omega = Math.max(0.1, frequency);
    const offset = state.x - target;
    const rate = state.velocity + omega * offset;
    const decay = Math.exp(-omega * seconds);
    const x = target + (offset + rate * seconds) * decay;
    const velocity = (state.velocity - omega * rate * seconds) * decay;
    return { x, velocity };
}

export function springAtRest(state: Spring, target: number): boolean {
    return Math.abs(state.x - target) <= 0.02 && Math.abs(state.velocity) <= 0.05;
}

/** Limit both DPR and GPU pixel count; never allocate an arbitrarily large framebuffer. */
export function clampPixelRatio(
    deviceRatio: number,
    cssWidth: number,
    cssHeight: number,
    maxRatio = 1.5
): number {
    const ratio = Math.min(Math.max(Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1, 0.5), Math.max(0.5, maxRatio));
    const maxPixels = 2_000_000;
    const area = Math.max(1, cssWidth * cssHeight);
    return Math.min(ratio, Math.sqrt(maxPixels / area));
}

/** A two-body liquid: the leading lobe moves before the tail's surface tension releases. */
export interface LiquidDrop {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    age: number;
}
export interface LiquidRipple {
    x: number;
    y: number;
    age: number;
    strength: number;
}
export interface LiquidMotion {
    head: Spring;
    tail: Spring;
    target: number;
    lag: number;
    traveling: boolean;
    split: boolean;
    drops: LiquidDrop[];
    ripples: LiquidRipple[];
}

export function makeLiquidMotion(x: number): LiquidMotion {
    return { head: makeSpring(x), tail: makeSpring(x), target: x, lag: 0, traveling: false, split: false, drops: [], ripples: [] };
}

export function retargetLiquidMotion(state: LiquidMotion, target: number): LiquidMotion {
    if (!Number.isFinite(target) || Math.abs(state.target - target) < 0.2) return state;
    return { ...state, target, lag: 0.105, traveling: true, split: false };
}

export function liquidAtRest(state: LiquidMotion): boolean {
    return !state.traveling && !state.drops.length && !state.ripples.length &&
        springAtRest(state.head, state.target) && springAtRest(state.tail, state.target);
}

/** Advances water by one frame. Deterministic particles allow precise regression tests. */
export function advanceLiquidMotion(
    state: LiquidMotion,
    dt: number,
    cy: number,
    radius: number,
    reduceMotion = false
): LiquidMotion {
    if (reduceMotion) return makeLiquidMotion(state.target);
    if (!Number.isFinite(dt) || dt <= 0) return state;
    const seconds = Math.min(dt, 0.05);
    const head = stepSpring(state.head, state.target, seconds, false, 23);
    const tail = state.lag > 0 ? state.tail : stepSpring(state.tail, state.target, seconds, false, 8.5);
    const lag = Math.max(0, state.lag - seconds);
    const separation = Math.abs(head.x - tail.x);
    const r = Math.max(4, radius);
    const pinching = !state.split && state.traveling && separation > r * 1.7;
    let drops = state.drops;
    if (pinching) {
        // Place satellite drops in the thin neck; they will chase the head and merge back.
        const direction = Math.sign(head.x - tail.x) || 1;
        drops = [0.32, 0.56, 0.77].map((t, i) => ({
            x: tail.x + (head.x - tail.x) * t,
            y: cy + (i - 1) * r * 0.13,
            vx: head.velocity * (0.12 + t * 0.2),
            vy: (i - 1) * -11 * direction,
            radius: r * (0.24 + (i === 1 ? 0.06 : 0)),
            age: 0
        }));
    }
    drops = drops.flatMap(drop => {
        const dx = head.x - drop.x;
        const vx = (drop.vx + (dx * 95 - drop.vx * 10) * seconds);
        const vy = (drop.vy + ((cy - drop.y) * 80 - drop.vy * 10) * seconds);
        const x = drop.x + vx * seconds;
        const y = drop.y + vy * seconds;
        const age = drop.age + seconds;
        const shrinking = Math.abs(head.x - x) < r * 1.4 || age > 0.42;
        const nextRadius = Math.max(0, drop.radius - (shrinking ? r * 1.8 : 0) * seconds);
        return nextRadius > 0.5 && age < 1.05 ? [{ x, y, vx, vy, radius: nextRadius, age }] : [];
    });
    const settled = springAtRest(head, state.target) && springAtRest(tail, state.target) && drops.length === 0;
    const traveling = state.traveling && !settled;
    const ripples = state.ripples
        .map(ripple => ({ ...ripple, age: ripple.age + seconds }))
        .filter(ripple => ripple.age < 0.85);
    if (state.traveling && settled) ripples.push({ x: state.target, y: cy, age: 0, strength: state.split ? 1.1 : 0.7 });
    return { ...state, head, tail, lag, traveling, split: state.split || pinching, drops, ripples };
}
