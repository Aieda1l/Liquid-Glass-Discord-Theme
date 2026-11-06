# LiquidGlassFx (experimental Vencord userplugin)

This is **Stage A** of the separate shader-based liquid-glass enhancement for Reze Boom. It renders a small Waterline-style navigation control and Surface Tension-style toggle in the plugin settings UI. The GPU draws a glass height field, specular highlights, and true offset texture samples of a **generated demo wallpaper**. It does **not** sample Discord's rendered UI or live chat content.

**This is not the `.theme.css` file.** Online Themes and ordinary CSS installations cannot execute it. The existing `RezeBoom.theme.css` works with or without this companion.

## Install in a development Vencord checkout

1. Build Vencord from source following the current [Vencord custom plugin guide](https://docs.vencord.dev/installing/custom-plugins/).
2. Copy this entire `liquidGlassFx` directory to `<Vencord checkout>/src/userplugins/liquidGlassFx/`, preserving `index.tsx` at that exact path.
3. Follow the upstream build/injection instructions for your target client, then open **Vencord → Plugins → LiquidGlassFx → Settings**.
4. Click the preview navigation tabs and the switch. They are demonstration controls; they don't change Discord settings or channel selection.

A recent Vencord checkout is needed because internal plugin APIs can change. A source-built custom client is separate from the publicly distributed installer. Do not place the plugin directory in your ordinary Vencord themes folder.

## Behavior and constraints

- **Real shader work:** A WebGL 1 fragment shader refracts an independently generated wallpaper texture using normals from a signed-distance height field. The sample is moved in the GPU, not faked with CSS gradients.
- **Current boundary:** This proves only the self-owned preview composition. It is *not yet* genuine refraction of pixels behind Discord elements, and no live navigation or settings toggles are patched.
- **GPU fallback:** When WebGL is missing, fails compilation or loses its context, the preview remains clickable with a CSS glass approximation.
- **Accessibility:** Buttons retain native keyboard activation; the toggle exposes `role="switch"` and `aria-checked`; focus is visible. The canvas has `aria-hidden` and does not intercept clicks.
- **Performance:** A single canvas/WebGL context is created per open preview. Texture resolution is capped, rendering pauses at rest or offscreen, and resources/listeners/observers are released on unmount. The OS reduced-motion setting snaps springs to their targets.
- **Privacy:** No DOM text extraction, screen capture, remote wallpaper loads, telemetry, message access, `readPixels` or network requests.

## Verification

In this theme repo, `npm test` runs the existing PostCSS checks and focused motion/safety-contract tests. This does **not** substitute for building against an actual Vencord checkout, checking shader compilation on a GPU, or testing interactions in a live client. Those are required before calling this production ready.

## Next stages

After testing the preview in a source-built Vencord client, identify a stable and authorized React patch point for selected channels, then integrate a shared decorative renderer without changing Discord's click handling. Integrate native settings toggles only after inspecting their current component contracts. See [`docs/VENCORD_PLUGIN_PLAN.md`](../../../docs/VENCORD_PLUGIN_PLAN.md).

Visual behavior references: Nimbus UI “Waterline” and “Surface Tension” examples supplied by the theme author, credited to guglielmogiannattasio.it. The shader and spring code here were written independently, not copied from those examples.
