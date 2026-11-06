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
