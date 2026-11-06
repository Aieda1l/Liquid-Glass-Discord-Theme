import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const dir = new URL('../src/userplugins/liquidGlassFx/', import.meta.url);
const read = path => readFileSync(new URL(path, dir), 'utf8');

test('selected row geometry clips to its own scroll viewport and rejects offscreen targets', async () => {
    const { selectionInViewport } = await import(new URL('liveGeometry.ts', dir));
    const viewport = { left: 100, top: 40, width: 260, height: 500 };
    assert.equal(selectionInViewport({ left: 118, top: 160, width: 224, height: 40 }, viewport), true);
    assert.equal(selectionInViewport({ left: 118, top: 550, width: 224, height: 40 }, viewport), false);
    assert.equal(selectionInViewport({ left: 118, top: 520, width: 224, height: 40 }, viewport), true);
    assert.equal(selectionInViewport({ left: 620, top: 160, width: 224, height: 40 }, viewport), false);
    assert.equal(selectionInViewport({ left: 118, top: 160, width: 0, height: 40 }, viewport), false);
});

test('zoom-safe live selection geometry is relative to the canvas, not desktop coordinates', async () => {
    const { rectInCanvasSpace } = await import(new URL('coordinates.ts', dir));
    const canvasBounds = { left: 100, top: 40, width: 312, height: 600 };
    const selected = { left: 130, top: 160, width: 252, height: 48 };
    const css = { width: 260, height: 500 };
    assert.deepEqual(rectInCanvasSpace(selected, canvasBounds, css), {
        x: 25, y: 100, width: 210, height: 40
    });
});

test('Stage B opt-in is off by default and patches only the known guild channel list slot', () => {
    const source = read('index.tsx');
    assert.match(source, /enableLiquidNav:\s*\{/);
    assert.match(source, /default:\s*false/);
    assert.match(source, /restartNeeded:\s*true/);
    assert.match(source, /find:\s*"UNREAD_IMPORTANT:"/);
    assert.match(source, /\$self\.LiquidNavAnchor/);
    assert.match(source, /CHANNEL_SELECT\s*\(/);
    assert.match(source, /start\s*\(/);
    assert.match(source, /stop\s*\(/);
});

test('live host is a single bounded canvas that cannot take focus or pointer clicks', () => {
    const source = read('liveNav.tsx');
    const css = read('styles.css');
    assert.match(source, /createElement\("canvas"\)/);
    assert.match(source, /aria-hidden/);
    assert.match(source, /\.disconnect\(\)/);
    assert.match(source, /cancelAnimationFrame\(/);
    assert.match(source, /webglcontextlost/);
    assert.match(css, /\.lgfx-live-overlay\s*\{[^}]*pointer-events:\s*none/s);
    assert.doesNotMatch(source, /MutationObserver|readPixels|getDisplayMedia|fetch\(/);
});

test('live fragment shader is transparent, samples no Discord content, and responds to tail/ripple motion', () => {
    const source = read('liveRenderer.ts');
    assert.match(source, /alpha:\s*true/);
    assert.match(source, /uTailY/);
    assert.match(source, /uDrops/);
    assert.match(source, /uRipples/);
    assert.match(source, /gl_FragColor\s*=\s*vec4/);
    assert.doesNotMatch(source, /getDisplayMedia|readPixels|captureStream|fetch\(/);
});

test('channel row anchors registered before plugin start are replayed when overlay starts', () => {
    const source = read('liveNav.tsx');
    assert.match(source, /const anchorRows = new Map/);
    assert.match(source, /for \(const \[id, row\] of anchorRows\)/);
    assert.match(source, /anchorRows\.set\(channelId, row\)/);
});

test('chat scrolling does not reset the live channel spring; channel-list scrolling does', async () => {
    const { scrollAffectsViewport } = await import(new URL('liveGeometry.ts', dir));
    const channelSubScroller = { nodeType: 1 };
    const chatScroller = { nodeType: 1 };
    const viewport = { contains: node => node === channelSubScroller };
    assert.equal(scrollAffectsViewport(viewport, chatScroller), false);
    assert.equal(scrollAffectsViewport(viewport, viewport), true);
    assert.equal(scrollAffectsViewport(viewport, channelSubScroller), true);
    assert.equal(scrollAffectsViewport(null, chatScroller), false);
    const source = read('liveNav.tsx');
    assert.match(source, /scrollAffectsViewport\(this\.scrollHost, event\.target\)/);
    assert.doesNotMatch(source, /private readonly onScroll = \(\) => this\.reposition\(\)/);
});

test('the live glass rim is enhanced only when the two motion lobes separate', () => {
    const source = read('liveRenderer.ts');
    assert.match(source, /float motionAmount = clamp\(abs\(uHeadY - uTailY\)/);
    assert.match(source, /float movingGlint = motionAmount \* edge/);
    assert.match(source, /edge \* 0\.38 \+ movingGlint/);
});
