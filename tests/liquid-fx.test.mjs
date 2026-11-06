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
