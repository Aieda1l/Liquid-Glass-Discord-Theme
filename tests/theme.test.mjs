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
  assert.match(css, /@version 4\.2\.3/);
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


test("chat history is frosted exactly at the content pane, not on message text", () => {
  const rules = findRules("chatContent_").filter(rule =>
    rule.selector.startsWith("#app-mount") &&
    rule.nodes.some(node => node.prop === "backdrop-filter" && node.value.includes("--rz-chat-history-blur"))
  );
  assert.equal(rules.length, 1, "one shared blur pane rather than individual message blurs");
  const pane = rules[0];
  const bg = pane.nodes.find(node => node.prop === "background");
  assert.ok(bg?.important);
  assert.match(bg.value, /rz-chat-history-tint/);
  assert.ok(pane.nodes.some(node => node.prop === "-webkit-backdrop-filter" && node.important));
  assert.match(css, /--rz-chat-history-blur: 6px/);
});

test("composer clears opaque nested surfaces while keeping editable content", () => {
  const nested = findRules("scrollableContainer_").find(rule =>
    rule.selector.includes("channelTextArea_") &&
    rule.nodes.some(node => node.prop === "background-image" && node.value === "none" && node.important)
  );
  assert.ok(nested, "nested scrollable composer background should be cleared");
  const body = findRules("channelTextArea_").find(rule =>
    rule.selector.startsWith("#app-mount") &&
    rule.nodes.some(node => node.prop === "background" && node.value.includes("--rz-composer-tint"))
  );
  assert.ok(body, "glass effect belongs on the composer capsule");
  assert.ok(body.nodes.some(node => node.prop === "backdrop-filter" && node.value.includes("blur(17px)")));
});

test("quest bar has a stable selector, frost and scoped inner cleanup", () => {
  const bar = findRules('[data-testid="quest-bar-container"]').find(rule =>
    rule.nodes.some(node => node.prop === "backdrop-filter" && node.value.includes("blur(14px)"))
  );
  assert.ok(bar);
  assert.ok(bar.nodes.some(node => node.prop === "background" && node.value.includes("--rz-quest-card-tint")));
  const inner = findRules('[data-testid="quest-bar-container"]').find(rule =>
    rule.selector.includes("postEnrollmentBackground_") &&
    rule.nodes.some(node => node.prop === "background-image" && node.value === "none")
  );
  assert.ok(inner);
  assert.doesNotMatch(inner.selector, /\[class\*="button_/);
});

test("opacity fallback keeps chat and quest text legible without backdrop-filter", () => {
  let found = false;
  root.walkAtRules("supports", rule => {
    if (!rule.params.startsWith("not ")) return;
    const str = rule.toString();
    if (str.includes("--rz-chat-history-tint: rgba(7, 5, 24, 0.88)") &&
        str.includes("--rz-quest-card-tint: rgba(20, 15, 48, 0.90)")) found = true;
  });
  assert.ok(found);
});


test("chat blur is restrained and wallpaper remains visible", () => {
  const rootDecl = [];
  root.walkDecls("--rz-chat-history-blur", d => rootDecl.push(d.value));
  assert.deepEqual(rootDecl, ["6px"]);
  assert.match(css, /--rz-chat-history-tint: rgba\(7, 5, 24, 0\.32\)/);
  const pane = findRules("chatContent_").find(rule =>
    rule.selector.startsWith("#app-mount") &&
    rule.nodes.some(d => d.prop === "backdrop-filter" && d.value.includes("--rz-chat-history-blur"))
  );
  assert.ok(pane);
  assert.ok(pane.nodes.some(d => d.prop === "backdrop-filter" && d.value.includes("brightness(0.98)")));
});

test("server unread markers and generic wrappers are never glow targets", () => {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(clean, /\[class\*="listItem[_-]"\]::(?:before|after)/);
  assert.doesNotMatch(clean, /rz-led-breathe|rz-led-pulse|--rz-glow/);
  assert.doesNotMatch(clean, /\[class\*="folder_"\]/);
  assert.ok(findRules("blobContainer_").some(rule =>
    rule.selector.includes("childWrapper_") && rule.nodes.some(n => n.prop === "box-shadow")
  ));
  assert.doesNotMatch(clean, /\[class\*="pill_"\][^{}]*\{[^{}]*box-shadow/);
});

test("folder glass does not change icon positions or preview content", () => {
  const folder = findRules("folderButton_").find(rule => rule.nodes.some(n => n.prop === "backdrop-filter"));
  assert.ok(folder);
  assert.ok(folder.nodes.some(n => n.prop === "outline" && n.important));
  assert.ok(findRules("expandedFolderBackground_").some(rule => rule.nodes.some(n => n.prop === "backdrop-filter")));
  const folderRules=[];
  root.walkRules(r=>{if(r.selector.includes("folderButton_")||r.selector.includes("blobContainer_"))folderRules.push(r)});
  const noGeometry=["width","height","margin-left","left","top","translate","transform","scale","overflow","z-index"];
  for(const rule of folderRules)for(const n of rule.nodes)if(n.type==="decl"){
    assert.ok(!noGeometry.includes(n.prop), `Must not alter guild geometry: ${n.prop} at ${n.source.start.line}`);
  }
});

test("major auxiliary surfaces use scoped glass rather than global resets", () => {
  for(const target of ["searchBarComponent_","contentRegion_","reaction_","pollContainer_","membersWrap_","toolbar_"]){
    assert.ok(findRules(target).length>0, `Missing ${target}`);
  }
  assert.doesNotMatch(css, /#app-mount\s+\*\s*\{[^}]*background:/);
});

test("guild decoration is motion safe", () => {
  let reduced=false;
  root.walkAtRules("media", rule=>{
    if(rule.params.includes("prefers-reduced-motion") && rule.toString().includes("folderButton_") &&
       rule.toString().includes("transition: none"))reduced=true;
  });
  assert.ok(reduced);
});

test("tooltips have exactly one glass frame, and nested content is undecorated", () => {
  const tooltip = findRules('[role="tooltip"]').find(rule =>
    rule.selector.includes('[class*="tooltip_"]') &&
    rule.nodes.some(n => n.prop === "backdrop-filter" && n.value.includes("blur(12px)")));
  assert.ok(tooltip, "tooltip shell should receive the blur and rim");
  assert.doesNotMatch(tooltip.selector, /tooltipContent_/);
  const inner = findRules("tooltipContent_").find(rule =>
    rule.selector.includes('[role="tooltip"]') &&
    rule.nodes.some(n => n.prop === "box-shadow" && n.value === "none"));
  assert.ok(inner, "inner tooltip should not get a second rectangle");
  for(const prop of ["background", "border", "outline", "box-shadow", "backdrop-filter", "-webkit-backdrop-filter"]){
    assert.ok(inner.nodes.some(n => n.prop === prop && n.important), `missing tooltip inner reset ${prop}`);
  }
  const outer = [];
  root.walkRules(rule => {
    if(rule.selector.includes("tooltipContent_") &&
      rule.nodes.some(n => n.prop === "border" && n.value !== "0")) outer.push(rule.selector);
  });
  assert.deepEqual(outer, [], "tooltip inner content must never receive its own border");
});

test("Quest receives one outer glass pane without nested quest card overlays", () => {
  const roots = [];
  root.walkRules(rule => {
    if(rule.selector.trim() === '#app-mount [data-testid="quest-bar-container"]' &&
      rule.nodes.some(n => n.prop === "backdrop-filter")) roots.push(rule);
  });
  assert.equal(roots.length, 1);
  assert.match(css, /--rz-quest-card-tint: rgba\(17, 12, 42, 0\.88\)/);
  assert.ok(roots[0].nodes.some(n => n.prop === "background" && n.value.includes("--rz-quest-card-tint")));
  const clean=css.replace(/\/\*[\s\S]*?\*\//g,"");
  assert.doesNotMatch(clean, /\[class\*="wrapper_"\]:has\(\[class\*="questProgressWrapper"\]\)/);
  const old = findRules("questBar_").filter(rule => rule.nodes.some(n => n.prop === "backdrop-filter"));
  assert.equal(old.length,0,"no blanket questBar_ fallback coating child nodes");
});

test("generic Discord buttons and dropdown arrow controls avoid double pills", () => {
  const decorated = [];
  root.walkRules(rule => {
    if (rule.selector.includes('button[class*="button_"]') &&
      rule.nodes.some(n => n.prop === "background-image" || n.prop === "border-radius")) decorated.push(rule);
  });
  for (const rule of decorated) {
    assert.ok(rule.selector.includes("userPopout_") || rule.selector.includes("userProfile_") ||
      rule.selector.includes("peopleList_"), `Unscoped button paint at ${rule.source.start.line}`);
  }
  const dropdown = findRules('button[aria-haspopup="menu"]').find(rule =>
    rule.selector.includes('section[aria-label="User area"]') &&
    rule.nodes.some(n => n.prop === "background" && n.value === "transparent"));
  assert.ok(dropdown, "user panel menu buttons should not get their own glass capsules");
  assert.ok(dropdown.nodes.some(n => n.prop === "box-shadow" && n.value === "none" && n.important));
  const focus = findRules('button[aria-haspopup="menu"]').find(rule =>
    rule.selector.includes(":focus-visible") &&
    rule.nodes.some(n => n.prop === "outline" && n.value.includes("rz-liquid-focus")));
  assert.ok(focus, "dropdowns retain keyboard focus indication");
});

test("Quest and tooltip fixes do not hide controls or change their geometry", () => {
  const clean=css.replace(/\/\*[\s\S]*?\*\//g,"");
  assert.doesNotMatch(clean, /\[data-testid="quest-bar-container"\] [^{}]*button[^{}]*\{[^{}]*display:\s*none/);
  assert.doesNotMatch(clean, /\[role="tooltip"\][^{}]*\{[^{}]*visibility:\s*hidden/);
  const dropdown = findRules('button[aria-haspopup="menu"]').find(rule =>
    rule.selector.includes('section[aria-label="User area"]') &&
    rule.nodes.some(n => n.prop === "background" && n.value === "transparent"));
  for (const node of dropdown.nodes) {
    if (node.type !== "decl") continue;
    assert.ok(!["display", "pointer-events", "width", "height", "position", "transform", "overflow"].includes(node.prop),
       `Dropdown must keep its interaction/geometry: ${node.prop}`);
  }
});
