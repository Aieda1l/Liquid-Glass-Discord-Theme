# LiquidGlassFx (experimental Vencord userplugin)

This is the **Stage A preview and experimental Stage B server-channel overlay** of the shader-based liquid-glass enhancement for Reze Boom. Stage A renders a Waterline-style navigation control and Surface Tension-style toggle in plugin settings. The GPU draws a glass height field, specular highlights, and true offset texture samples of a **generated demo wallpaper**. It does **not** sample Discord's rendered UI or live chat content.

**This is not the `.theme.css` file.** Online Themes and ordinary CSS installations cannot execute it. The existing `RezeBoom.theme.css` works with or without this companion.

## Install in a development Vencord checkout

1. Build Vencord from source following the current [Vencord custom plugin guide](https://docs.vencord.dev/installing/custom-plugins/).
2. Copy this entire `liquidGlassFx` directory to `<Vencord checkout>/src/userplugins/liquidGlassFx/`, preserving `index.tsx` at that exact path.
3. Follow the upstream build/injection instructions for your target client, then open **Vencord → Plugins → LiquidGlassFx → Settings**.
4. Click the preview navigation tabs and the switch. These demonstration controls don't change Discord settings or channel selection.
5. **To test Stage B**, enable the **Experimental GPU highlight for selected server channels** option in LiquidGlassFx's settings, then fully restart the client. Open a server and switch between its text channels. Turn the option off and restart to return to the ordinary theme-only channel highlight.

A recent Vencord checkout is needed because internal plugin APIs can change. A source-built custom client is separate from the publicly distributed installer. Do not place the plugin directory in your ordinary Vencord themes folder.

## Behavior and constraints

- **Real shader work:** A WebGL 1 fragment shader refracts an independently generated wallpaper texture using normals from a signed-distance height field. The sample is moved in the GPU, not faked with CSS gradients.
- **Current boundary:** Stage A refracts only the generated wallpaper. Stage B provides an *opt-in shader-rendered transparent highlight* over selected server channels. Its GPU output is specular/tinted light, **not background refraction of Discord messages or UI pixels**. The selected channel row and click handlers remain Discord-owned. Direct messages, settings switches, and live pixel displacement are not integrated yet.
- **Integration compatibility:** The experimental insertion point uses the upstream Vencord `TypingIndicator` guild-channel marker pattern (`UNREAD_IMPORTANT:`). The host channel link and scroller are checked at runtime; if a Discord update changes them, the live overlay hides itself and the ordinary theme still works. This is intentionally disabled by default and requires restarting Vencord after enabling it.
- **GPU fallback:** When WebGL is missing, fails compilation or loses its context, the preview remains clickable with a CSS glass approximation.
- **Accessibility:** Buttons retain native keyboard activation; the preview toggle exposes `aria-pressed` on a native button (instead of `role="switch"`, which triggers Discord/theme switch selectors); focus is visible. The canvas has `aria-hidden` and does not intercept clicks.
- **Performance:** Stage A creates one context per open preview. Stage B uses **one shared, scroll-viewport-clipped canvas** (not one per channel or message). Rendering pauses when motion settles, when selection is offscreen, or when graphics are unsupported. Observers, animation frames, listeners and GPU resources are released when the plugin stops. The OS reduced-motion setting snaps springs to their targets.
- **Privacy:** No DOM text extraction, screen capture, remote wallpaper loads, telemetry, message access, `readPixels` or network requests.

## Verification

In this theme repo, `npm test` runs the existing PostCSS checks and focused motion/safety-contract tests. This does **not** substitute for building against an actual Vencord checkout, checking shader compilation on a GPU, or testing interactions in a live client. Those are required before calling this production ready.

## Next stages

Test the Stage B overlay in real Discord at different zoom levels, server/channel combinations, category scrolling and plugin combinations. If its upstream marker stops matching, revise the targeted patch rather than guessing at global DOM selectors. Integrate native settings toggles only after inspecting their current component contracts. See [`docs/VENCORD_PLUGIN_PLAN.md`](../../../docs/VENCORD_PLUGIN_PLAN.md).

Visual behavior references: Nimbus UI “Waterline” and “Surface Tension” examples supplied by the theme author, credited to guglielmogiannattasio.it. The shader and spring code here were written independently, not copied from those examples.
