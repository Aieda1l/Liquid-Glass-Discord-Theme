# Liquid Glass FX — Vencord UserPlugin Design Plan

**Status:** Planned only. This document is not an installed or runnable plugin.
**Project:** Reze Boom Liquid Glass (CSS remains the required, independently useful base).
**Owner / theme author:** a1edail.
**Design references:** The user-supplied React components **Nimbus UI · Liquid Navbar (“Waterline”)** and **Nimbus UI · Liquid Toggle (“Surface Tension”)**, credited in their source headers to guglielmogiannattasio.it. Their source is a visual and behavioral reference; do not copy shaders or code into the plugin without establishing an appropriate reuse license or obtaining permission.

## 1. Desired outcome and scope

Make **small interactive Discord controls** look like moving liquid: a sliding and merging selected-channel indicator, glossy meniscus rims, responsive hover caustics, and a soft spring-like switch knob. Keep large, text-heavy chat history under the current CSS-only backdrop blur to preserve readability. The plugin should **enhance** rather than replace the theme; when disabled or unsupported, the CSS theme continues working.

### Priorities

1. **P0, functional:** transparent composer and Quest bar, blurred/tinted chat history, accessible hover/focus states (already handled by theme CSS).
2. **P1, prototype:** one shader-rendered pill, matching the visual language of Waterline, over **a plugin-owned React preview** inside a Vencord plugin settings panel.
3. **P2, integration:** selected DM/channel liquid indicators and navigation transitions using a patch to an identified Discord React slot; preserve native click handling, keyboard focus, aria labels and scrolling.
4. **P3, integration:** Surface Tension-style track/knob animation for selected settings toggles via a well-scoped React wrapper or patch, preserving underlying state changes; do not indiscriminately restyle every switch at runtime.
5. **P4, polish:** hover glints, subtle ripples, intensity controls, theme-color sync, performance measurement, optional audio **off by default**, and graceful fallbacks.

## 2. Supported deployment

- Implement as `src/userplugins/liquidGlassFx/index.tsx` in a **development Vencord source checkout**. Optional supporting files: `shader.ts`, `physics.ts`, `LiquidOverlay.tsx`, `styles.css`, `README.md`; use `index.tsx` as the entry point with `definePlugin`.
- Vencord's current documentation explicitly requires a source build for custom userplugins. The normal Vencord installer and the Online Themes URL **cannot directly install** this custom plugin.
- For Windows with OneDrive Documents synchronization, clone/build in e.g. `C:\dev\Vencord`, **outside** `Documents`; this is separate from the Online Themes CSS and does not modify OneDrive.
- Follow upstream Vencord source/build instructions as of development time. Typical commands: `pnpm install`, `pnpm build`, `pnpm inject` (build and injection steps should be validated against the targeted checkout). Do not ship a compiled Vencord fork in the theme repository.
- Keep the plugin independent from remote scripts, themes and APIs; do not use `native.ts` or Node filesystem access unless a documented need emerges.

Sources:
- https://docs.vencord.dev/plugins/
- https://docs.vencord.dev/plugins/common/
- https://docs.vencord.dev/installing/custom-plugins/
- https://docs.vencord.dev/installing/

## 3. Architecture

```text
Vencord userplugin: liquidGlassFx
  index.tsx          definePlugin, settings and lifecycle
  components/        React LiquidSurface + preview UI
  rendering/         one shared WebGL/WebGL2 context and shader program
  physics/           spring solver, blob merging and ripple state
  styles.css         static CSS fallback / positions / pointer-events
  targets/           narrowly scoped, version-verified React host integrations
  tests/             unit math tests and mock-DOM integration tests

Existing RezeBoom.theme.css
  wallpaper, chat blur, quest transparency, composer
  static visual design, reduced-motion and no-WebGL fallback
```

### Scene and compositing

- Render **only lightweight translucent glass glints, droplets and surface normals** in a transparent canvas. Place it **above a CSS backdrop-filter glass surface**, **below text/icons**, and use `pointer-events: none`. Never intercept pointer events or keyboard input from Discord's actual UI.
- A WebGL canvas **does not automatically receive Discord's composited pixels** as a texture. A real background-displacement effect would require a **permitted, same-origin texture** or explicitly loaded wallpaper image (and CORS access if needed). Do **not** attempt unauthorized screen capture or reading message pixels; never capture, log, store or transmit user message content.
- Initial shader draws its own highlights/caustics over CSS-blurred wallpaper. Optional image-space refraction should sample **only the theme wallpaper loaded as a GPU texture**, not arbitrary Discord content. Verify CORS/caching and image license before enabling this feature.
- On WebGL failure or context loss, discard GPU resources and switch to existing CSS glass. The plugin must never block Discord from rendering.

### Integration strategy

- **Start with a self-contained plugin settings preview** to validate the graphics and performance.
- Use Vencord's documented `definePlugin`, `definePluginSettings`, React components, and source patches. Inject a React host at a verified stable UI boundary only after inspecting the **current Discord DOM/module** in a development build.
- Avoid indiscriminate DOM mutations and unbounded MutationObservers. Vencord's upstream guidelines discourage raw DOM manipulation; prefer patches and React-owned components. If the appropriate React injection point cannot be found safely, ship the preview and CSS fallback, not a brittle production patch.
- Integrate selection state via props / existing state stores when available; preserve click, tab navigation, screen readers, selected-state semantics, and pointer targets. Overlay has `aria-hidden="true"`.
- **No WebGL canvas per message.** A single renderer or a very small pooled set should handle visible interactive surfaces.

## 4. Motion design

**Waterline / navigation**
- When selecting a channel: an active indicator spring interpolates toward the target. On longer jumps it temporarily narrows, stretches, pinches and rejoins; a ripple dampens out when settled.
- On hover: a localized meniscus/specular reflection brightens. Idle state renders a still surface; only changed states schedule frames.
- Selection movement follows scroll and resize via React measurements / ResizeObserver and respects clipping; do not detach content from its scroll container.

**Surface Tension / toggle**
- A droplet-like knob briefly stretches and compresses during state transitions; animated fill follows behind.
- Keyboard changes (Space/Enter) produce equivalent transitions; `aria-checked`, `disabled`, focus and labeling remain native.
- The native input/switch remains the interaction source of truth; shader/canvas is purely decorative.

## 5. Controls, safety and performance

Suggested settings, all off or conservative by default where risky:
- `enableLiquidNav` (boolean, experimental)
- `enableLiquidSwitches` (boolean, experimental)
- `quality` (low/medium/high; medium default)
- `glintIntensity` (0–100%; moderate default)
- `distortionStrength` (0–100%; 0 for wallpaper refraction unless explicitly enabled)
- `respectReducedMotion` (always true)
- `debugPerformance` (false)

Constraints:
- Clamp devicePixelRatio (e.g. `Math.min(dpr, 1.5)` by default and never >2), cap render target area, avoid large backdrop-filter stacks.
- No background idle render loop. Schedule `requestAnimationFrame` only for active gestures/transitions and pause offscreen via `IntersectionObserver`.
- Clean up `ResizeObserver`, event listeners, animation frames, GPU buffers/textures on plugin stop, navigation remount and context loss.
- Avoid overriding Discord's own switch transforms and animations unless an explicit supported host contract is established.
- When `prefers-reduced-motion: reduce`, render static highlights and disable spring/droplet/ripple effects.
- Respect high contrast and platform DPI; no reads of messages or external telemetry. Debug counters stay local, ephemeral and off by default.
- Reliability over effects: prefer a visually static but correct control to an unclickable or flickering one.

## 6. Acceptance tests and gates

**Stage A — isolated renderer:**
- React demo loads inside a development Vencord settings view, at 100/125/150/200% scaling; check shader compiles and canvas fallback works.
- Automated unit tests for spring damping, target switching, reduced-motion, destroyed-state cancellation, and resource cleanup.
- FPS / frametime profiling on an integrated GPU and a midrange discrete GPU; no continuous idle animation and no persistent WebGL memory growth.

**Stage B — Discord navigation:**
- Inspect active stable/Canary Discord markup at implementation time. Validate DM and server navigation, hover, quick channel switch, collapsed/expanded sidebar, scrolling, and zoom.
- Validate keyboard-only navigation and accessible focus; no invisible overlays or stolen clicks.
- Test Vencord changes and conflicting installed themes.

**Stage C — toggles:**
- Verify mouse drag/tap, keyboard toggling, disabled state, checked persistence, native focus and settings re-render.
- Check regression when Discord's component implementation changes.

**Stage D — release:**
- CI on PRs: TypeScript/build, ESLint, shader lint/compile test, unit tests, and visual screenshot snapshots in a deterministic test harness.
- Manual Discord screenshot review in DMs, server chat, settings, popouts, Quest bar, emoji picker, dark appearance, reduced motion, high contrast.
- Plugin enabled/disabled/re-enabled without restarts (if Vencord's patch mechanism permits; some patches require restart) and safe fallback if graphics are unsupported.
- Do not release as "real refraction" unless sampling and visual tests demonstrate real background distortion from an explicitly permitted texture.

## 7. Decision log / immediate next steps

1. Keep the **4.2.1 CSS changes** as the immediate production fix. They address the user's actual screenshot without requiring a custom build.
2. Prototype a stand-alone WebGL/React liquid pill and toggle rendering view with original shader code; do not copy the reference implementation without a license review.
3. After performance/interaction validation, identify and patch one Vencord-friendly navigation React slot. Stop if the only option is fragile global DOM manipulation.
4. Expand to settings toggles, document setup and fallback behavior, and capture before/after screenshots from a live test client.

**Known unknowns:** The exact Discord UI component host and userplugin integration patch points must be inspected in a live development build. A stable CSS selector does not guarantee a stable React module boundary.
