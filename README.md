# Reze Boom — Liquid Glass

A violet liquid-glass Discord theme with a customizable wallpaper, deep optical surfaces, responsive channel pills, glossy switches, bright meniscus highlights, and animated server-icon glow.

> **For Vencord / Vesktop / BetterDiscord users.** Unofficial custom CSS: Discord can change its UI without notice. This theme aims to reduce dependence on Discord's generated CSS hashes, but appearance still needs testing after major Discord updates.

## Install in Vencord

1. Install [Vencord](https://vencord.dev/download/) for desktop Discord.
2. Open **Discord → User Settings → Vencord → Themes**.
3. Add the URL below under **Online Themes** and apply it:

   ```text
   https://raw.githubusercontent.com/Aieda1l/Liquid-Glass-Discord-Theme/main/RezeBoom.theme.css
   ```

4. Reload Discord with **Ctrl+R** if the wallpaper does not appear immediately.

**Local installation:** Download [RezeBoom.theme.css](./RezeBoom.theme.css), press **Win+R**, open `%appdata%\Vencord\themes`, and save it there. Enable it under **Local Themes**. This folder is **not** inside Documents, so OneDrive's Documents synchronization does not affect it.

## Customize the look

Open `RezeBoom.theme.css` and edit the variables at the beginning of the `:root` rule.

| Variable | Purpose |
| --- | --- |
| `--theme-background-image` | Direct image URL used behind Discord. |
| `--main-theme-color` | Base accent color for your own overrides. |
| `--rz-font-family` | Font stack (Poppins is the default). |
| `--rz-wallpaper-dim` | Darkness of the overlay to improve text contrast. |
| `--rz-glass-frost`, `--rz-glass-semi`, `--rz-glass-deep` | Opacity of the frosted and deeper glass surfaces. |
| `--rz-blur-heavy`, `--rz-blur-medium`, `--rz-blur-light` | Blur intensity; lower values improve performance. |
| `--rz-liquid-veil` | Tint used in the message composer and light glass controls. |
| `--rz-liquid-depth` | Dark-violet transparency of modal, menu and popout surfaces. |
| `--rz-liquid-rim`, `--rz-liquid-top` | Specular glass edges and bright top highlights. |
| `--rz-liquid-focus` | Keyboard focus color on switches and controls. |
| `--rz-liquid-speed` | Interaction duration (animations are reduced when the OS requests it). |

To make local changes without losing them during updates, put **only** your variable overrides in Vencord **QuickCSS**, for example:

```css
:root {
  --theme-background-image: url("https://example.com/my-wallpaper.jpg");
  --rz-wallpaper-dim: rgba(6, 4, 18, 0.55);
}
```

Use a directly accessible HTTPS image URL, not a web page URL. The theme renders a violet gradient if the wallpaper cannot load. Background art and icons hosted on third-party sites may disappear or change without warning.

## Liquid-glass design

Version **4.2.0** draws from the **Waterline** (liquid navbar) and **Surface Tension** (liquid toggle) React examples supplied by the user, credited in their headers to [guglielmogiannattasio.it](https://guglielmogiannattasio.it/). This theme adapts the **appearance** rather than copying their JavaScript or WebGL shader.

- **Selected channels and DMs:** curved translucent pill selection, specular meniscus highlights, subtle spring-settle.
- **Switches:** a glassy stateful track, white reflected rims, and a compressed knob on press (where Discord exposes a recognizable knob).
- **Menus, popouts and modals:** layered caustics, violet/blue edge fringing and paused-at-rest optical rims.
- **Text composer and small buttons:** wet glass reflections without full-screen refraction filters.

**Important:** Vencord themes are CSS, not React. Genuine pixel-by-pixel water refraction, arbitrary cursor-tracking ripples, droplet splits and physically simulated knob movement need WebGL/JavaScript integration and **are not present** in the theme. The CSS deliberately approximates those visuals to stay compatible with Discord and minimize animation overhead. Real rendered output varies with Discord builds.

Use Windows **Reduce Motion** if you prefer static effects. Forced-colors mode also removes decorative backgrounds from relevant controls.

## Troubleshooting

- **No wallpaper:** Confirm the theme is enabled, reload Discord, and open the image URL in your browser. Remove any previous QuickCSS *background repair* snippet that might override the updated theme. If needed, set a different `--theme-background-image`.
- **A surface is solid instead of glass:** Set Discord to a dark appearance; try disabling other themes / QuickCSS temporarily. Discord may have changed its internal layout.
- **Lag on older GPUs:** Reduce the `--rz-blur-*` variables or enable **Reduce Motion** in your OS accessibility settings.
- **Theme does not update:** Remove and re-add the Online Theme URL, or download the latest CSS for local use.

## Design and compatibility

The theme does **not** import NotAnotherAnimeTheme's older generated-class stylesheet. It applies the wallpaper to Discord's stable `#app-mount` element, includes fallbacks for unrecognized backgrounds, and prioritizes readable overlays. Animations honor `prefers-reduced-motion`.

**Credit:** This project was inspired by [NotAnotherAnimeTheme](https://github.com/puckzxz/NotAnotherAnimeTheme) by puckzxz, with additional violet glass design and compatibility work.

There is no official affiliation with Discord or Vencord.
