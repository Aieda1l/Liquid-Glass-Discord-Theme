import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { makeSpring, stepSpring, springAtRest, clampPixelRatio } from '../src/userplugins/liquidGlassFx/motion.ts';

test('spring returns its target at rest', () => {
    assert.deepEqual(stepSpring(makeSpring(12), 12, 0.016), makeSpring(12));
    assert.ok(springAtRest(makeSpring(12), 12));
});

test('spring moves toward a destination and settles without a permanent animation', () => {
    let state = makeSpring(16);
    for (let i = 0; i < 180; i++) state = stepSpring(state, 220, 1 / 60);
    assert.ok(Math.abs(state.x - 220) <= 0.02, `position ${state.x}`);
    assert.ok(springAtRest(state, 220), `velocity ${state.velocity}`);
});

test('new targets work during motion without teleporting', () => {
    const from = stepSpring(makeSpring(30), 130, 1 / 60);
    const reversed = stepSpring(from, 10, 1 / 60);
    assert.ok(reversed.x !== 10);
    assert.ok(Number.isFinite(reversed.velocity));
    let state = reversed;
    for (let i = 0; i < 180; i++) state = stepSpring(state, 10, 1 / 60);
    assert.ok(springAtRest(state, 10));
});

test('reduce-motion snaps to target and clears velocity', () => {
    assert.deepEqual(stepSpring({ x: 10, velocity: 200 }, 300, 0.016, true), makeSpring(300));
});

test('invalid or long frame times cannot corrupt spring state', () => {
    const from = { x: 20, velocity: 100 };
    assert.deepEqual(stepSpring(from, 80, -1), from);
    const long = stepSpring(from, 80, 10);
    assert.ok(Number.isFinite(long.x));
    assert.ok(Number.isFinite(long.velocity));
    assert.ok(long.x < 80);
});

test('pixel ratio respects device scale, quality cap and canvas area', () => {
    assert.equal(clampPixelRatio(3, 640, 260, 1.5), 1.5);
    assert.equal(clampPixelRatio(0, 640, 260, 1.5), 1);
    const ratio = clampPixelRatio(2, 2000, 2000, 2);
    assert.ok(ratio <= 1, `large target ratio ${ratio}`);
    assert.ok(2000 * 2000 * ratio ** 2 <= 2_100_000);
});

test('shader samples only plugin-owned wallpaper texture, with genuine normal-offset refraction', async () => {
    const source = readFileSync(new URL('../src/userplugins/liquidGlassFx/rendering.ts', import.meta.url), 'utf8');
    const FRAGMENT_SHADER = source.match(/export const FRAGMENT_SHADER = `([\s\S]*?)`;/)?.[1] || '';
    const VERTEX_SHADER = source.match(/export const VERTEX_SHADER = `([\s\S]*?)`;/)?.[1] || '';
    assert.match(VERTEX_SHADER, /gl_Position/);
    assert.match(FRAGMENT_SHADER, /uniform sampler2D uBackdrop/);
    assert.match(FRAGMENT_SHADER, /texture2D\(uBackdrop/);
    assert.match(FRAGMENT_SHADER, /normal\.xy\s*\*/);
    assert.doesNotMatch(FRAGMENT_SHADER, /getDisplayMedia|readPixels|fetch\(/);
});

test('preview keeps live Discord untouched and maintains native control interaction', () => {
    const plugin = readFileSync(new URL('../src/userplugins/liquidGlassFx/index.tsx', import.meta.url), 'utf8');
    const preview = readFileSync(new URL('../src/userplugins/liquidGlassFx/LiquidPreview.tsx', import.meta.url), 'utf8');
    assert.match(plugin, /OptionType\.COMPONENT/);
    assert.doesNotMatch(plugin, /patches\s*:/);
    assert.match(preview, /aria-pressed/);
    assert.match(preview, /aria-checked/);
    assert.match(preview, /webglcontextlost/);
    assert.match(preview, /cancelAnimationFrame/);
    assert.match(preview, /prefers-reduced-motion/);
    assert.match(preview, /IntersectionObserver/);
    assert.match(preview, /\.disconnect\(\)/);
});

// Surface Tension/Waterline behavior contracts: test first, before implementation.
test('liquid motion keeps a delayed tail so a 44px switch travel stretches visibly', async () => {
    const { makeLiquidMotion, retargetLiquidMotion, advanceLiquidMotion } = await import('../src/userplugins/liquidGlassFx/motion.ts');
    let liquid = retargetLiquidMotion(makeLiquidMotion(0), 44);
    for (let i = 0; i < 5; i++) liquid = advanceLiquidMotion(liquid, 1 / 60, 18, 15);
    assert.ok(Math.abs(liquid.head.x - liquid.tail.x) >= 20, `stretch=${liquid.head.x - liquid.tail.x}`);
});

test('long liquid travel pinches into small droplets, then remerges and stops animating', async () => {
    const { makeLiquidMotion, retargetLiquidMotion, advanceLiquidMotion, liquidAtRest } = await import('../src/userplugins/liquidGlassFx/motion.ts');
    let liquid = retargetLiquidMotion(makeLiquidMotion(0), 120);
    let sawDrops = false;
    let sawRipple = false;
    for (let i = 0; i < 300; i++) {
        liquid = advanceLiquidMotion(liquid, 1 / 60, 18, 19);
        sawDrops ||= liquid.drops.length > 0;
        sawRipple ||= liquid.ripples.length > 0;
    }
    assert.ok(sawDrops, 'travel should create pinched-off droplets');
    assert.ok(sawRipple, 'settling should emit a short-lived ripple');
    assert.equal(liquid.drops.length, 0);
    assert.equal(liquid.ripples.length, 0);
    assert.ok(liquidAtRest(liquid), 'no permanent animation loop at rest');
});

test('liquid motion reverses direction during motion without teleporting or stale droplets', async () => {
    const { makeLiquidMotion, retargetLiquidMotion, advanceLiquidMotion, liquidAtRest } = await import('../src/userplugins/liquidGlassFx/motion.ts');
    let liquid = retargetLiquidMotion(makeLiquidMotion(0), 160);
    for (let i = 0; i < 6; i++) liquid = advanceLiquidMotion(liquid, 1 / 60, 16, 19);
    const oldHead = liquid.head.x;
    liquid = retargetLiquidMotion(liquid, 0);
    assert.equal(liquid.head.x, oldHead);
    for (let i = 0; i < 320; i++) liquid = advanceLiquidMotion(liquid, 1 / 60, 16, 19);
    assert.ok(liquidAtRest(liquid));
    assert.ok(Math.abs(liquid.head.x) < 0.02);
});

test('reduced motion eliminates stretch, droplets and ripples immediately', async () => {
    const { makeLiquidMotion, retargetLiquidMotion, advanceLiquidMotion, liquidAtRest } = await import('../src/userplugins/liquidGlassFx/motion.ts');
    let liquid = retargetLiquidMotion(makeLiquidMotion(10), 140);
    liquid = advanceLiquidMotion(liquid, 1 / 60, 19, 16, true);
    assert.equal(liquid.head.x, 140);
    assert.equal(liquid.tail.x, 140);
    assert.deepEqual(liquid.drops, []);
    assert.deepEqual(liquid.ripples, []);
    assert.ok(liquidAtRest(liquid));
});

test('renderer uses two-lobed signed-distance bodies plus droplets, ripples and track fill', () => {
    const source = readFileSync(new URL('../src/userplugins/liquidGlassFx/rendering.ts', import.meta.url), 'utf8');
    assert.match(source, /uniform\s+float\s+uNavTail/);
    assert.match(source, /uniform\s+float\s+uKnobTail/);
    assert.match(source, /uniform\s+vec4\s+uDrops\[\d+\]/);
    assert.match(source, /uniform\s+vec4\s+uRipples\[\d+\]/);
    assert.match(source, /uniform\s+float\s+uFillX/);
    assert.match(source, /float\s+smoothUnion\s*\(/);
});

test('switch supports pointer dragging without removing native click or keyboard semantics', () => {
    const source = readFileSync(new URL('../src/userplugins/liquidGlassFx/LiquidPreview.tsx', import.meta.url), 'utf8');
    assert.match(source, /onPointerDown=/);
    assert.match(source, /onPointerMove=/);
    assert.match(source, /onPointerUp=/);
    assert.match(source, /setPointerCapture/);
    assert.match(source, /onClick=/);
    assert.match(source, /aria-checked=/);
});
