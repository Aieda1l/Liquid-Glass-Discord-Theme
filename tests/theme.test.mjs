import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

const css = readFileSync(new URL("../RezeBoom.theme.css", import.meta.url), "utf8");
const root = postcss.parse(css, { from: "RezeBoom.theme.css" });

function findRules(selectorFragment) {
  const matches = [];
  root.walkRules(rule => {
    if (rule.selector.includes(selectorFragment)) matches.push(rule);
  });
  return matches;
}

test("valid CSS syntax and substantive stylesheet", () => {
  assert.ok(css.length > 10000);
  assert.ok(root.nodes.length > 20);
});

test("correct and self-contained theme metadata", () => {
  assert.match(css, /@name Reze Boom — Liquid Glass/);
  assert.match(css, /@author a1edail/);
  assert.match(css, /@version 4\.2\.0/);
  assert.match(css, /@source https:\/\/github\.com\/Aieda1l\/Liquid-Glass-Discord-Theme/);
  assert.match(css, /@updateUrl https:\/\/raw\.githubusercontent\.com\/Aieda1l\/Liquid-Glass-Discord-Theme\/main\/RezeBoom\.theme\.css/);
  assert.doesNotMatch(css, /@invite\b/);
  assert.doesNotMatch(css, /discord\.(?:gg|com\/invite)\//i);
});

test("does not rely on outdated upstream generated class names", () => {
  const imports = [];
  root.walkAtRules("import", rule => imports.push(rule.params));
  assert.equal(imports.length, 1, "only the optional Google Fonts import remains");
  assert.match(imports[0], /fonts\.googleapis\.com/);
  assert.doesNotMatch(css, /naat\.v3\.css/);
  assert.ok(findRules("#app-mount").length > 0);
  assert.doesNotMatch(css, /\.appMount__[a-zA-Z0-9]+\s*\{/);
});

test("wallpaper, fallback, glass panels and Discord color tokens exist", () => {
  const app = findRules("#app-mount").find(rule => rule.selector.trim() === "#app-mount");
  assert.ok(app);
  const props = Object.fromEntries(app.nodes.filter(n => n.type === "decl").map(n => [n.prop, n.value]));
  assert.match(props["background-image"], /var\(--theme-background-image\)/);
  assert.match(props["background-image"], /gradient\(/);
  assert.equal(props["background-attachment"], "fixed");
  assert.ok(findRules("guilds_").length > 0);
  assert.ok(findRules("channelTextArea_").length > 0);
  assert.match(css, /--background-base-lowest:/);
});

test("blur declarations avoid expensive and unreliable SVG URL filters", () => {
  let filters = 0;
  root.walkDecls(/^(?:-webkit-)?backdrop-filter$/, decl => {
    filters += 1;
    assert.doesNotMatch(decl.value, /url\(/, `SVG backdrop-filter in ${decl.source?.start?.line}`);
  });
  assert.ok(filters > 10);
});

test("animation accessibility and focus styles remain present", () => {
  const media = [];
  root.walkAtRules("media", rule => media.push(rule.params));
  assert.ok(media.some(x => x.includes("prefers-reduced-motion")));
  assert.ok(findRules(":focus-within").length > 0);
});

test("theme CSS contains no javascript protocol or embedded remote execution", () => {
  assert.doesNotMatch(css, /javascript\s*:/i);
  assert.doesNotMatch(css, /@import[^;]*naat/i);
});

test("liquid optics cover navigation, switch states and layered glass", () => {
  assert.match(css, /LIQUID OPTICS — WATERLINE/);
  assert.ok(findRules('[role="switch"]').length > 0);
  assert.ok(findRules('[aria-checked="true"]').length > 0);
  assert.ok(findRules('[class*="modeSelected_"]').length > 0);
  assert.ok(findRules('channelTextArea_').length > 0);
  assert.ok(findRules('rz-liquid-settle').length > 0 || css.includes('@keyframes rz-liquid-settle'));

  const pane = findRules('[class*="modal_"]').find(rule =>
    rule.selector.includes('menu_') && rule.nodes.some(n => n.prop === "background"));
  assert.ok(pane, "modal and menu optical surfaces should be present");
  const background = pane.nodes.find(n => n.type === "decl" && n.prop === "background")?.value || "";
  assert.match(background, /radial-gradient/);
  assert.match(background, /linear-gradient/);
});

test("switch decoration cannot block interaction", () => {
  const track = findRules('[role="switch"]::after').find(rule =>
    rule.selector.trim() === '#app-mount [role="switch"]::after');
  assert.ok(track);
  assert.ok(track.nodes.some(n => n.type === "decl" &&
    n.prop === "pointer-events" && n.value === "none"));
});

test("liquid motion is not continuous and has accessibility alternatives", () => {
  const markers = [];
  root.walkAtRules("media", rule => markers.push(rule.params));
  assert.ok(markers.some(p => p.includes("prefers-reduced-motion")));
  assert.ok(markers.some(p => p.includes("forced-colors")));
  const baseRim = findRules('::after').find(rule =>
    rule.selector.includes('[class*="modal_"]') &&
    rule.nodes.some(n => n.prop === "animation-play-state" && n.value.includes("paused")));
  assert.ok(baseRim, "hero glass rim should be paused until interaction");
  const media = [];
  root.walkAtRules("media", rule => {
    if (rule.params.includes("prefers-reduced-motion")) media.push(rule.toString());
  });
  assert.ok(media.some(text => text.includes("rz-liquid-settle") || text.includes('[role="switch"]')));
});

test("CSS-only theme does not embed runtime scripts or shader canvases", () => {
  assert.doesNotMatch(css, /<script\b/i);
  assert.doesNotMatch(css, /@import[^;]*\.jsx?/i);
  assert.match(css, /The references implement their fluid surfaces with React \+ WebGL/);
});