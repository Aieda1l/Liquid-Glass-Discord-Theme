# Reze Boom — Liquid Glass

A violet, frosted-glass Discord theme with a customizable wallpaper, luminous glass edges, translucent chat surfaces, and an animated server-icon glow.

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

To make local changes without losing them during updates, put **only** your variable overrides in Vencord **QuickCSS**, for example:

```css
:root {
  --theme-background-image: url("https://example.com/my-wallpaper.jpg");
  --rz-wallpaper-dim: rgba(6, 4, 18, 0.55);
}
```

Use a directly accessible HTTPS image URL, not a web page URL. The theme renders a violet gradient if the wallpaper cannot load. Background art and icons hosted on third-party sites may disappear or change without warning.

## Troubleshooting

- **No wallpaper:** Confirm the theme is enabled, reload Discord, and open the image URL in your browser. Remove any previous QuickCSS *background repair* snippet that might override the updated theme. If needed, set a different `--theme-background-image`.
- **A surface is solid instead of glass:** Set Discord to a dark appearance; try disabling other themes / QuickCSS temporarily. Discord may have changed its internal layout.
- **Lag on older GPUs:** Reduce the `--rz-blur-*` variables or enable **Reduce Motion** in your OS accessibility settings.
- **Theme does not update:** Remove and re-add the Online Theme URL, or download the latest CSS for local use.

## Design and compatibility

The theme does **not** import NotAnotherAnimeTheme's older generated-class stylesheet. It applies the wallpaper to Discord's stable `#app-mount` element, includes fallbacks for unrecognized backgrounds, and prioritizes readable overlays. Animations honor `prefers-reduced-motion`.

**Credit:** This project was inspired by [NotAnotherAnimeTheme](https://github.com/puckzxz/NotAnotherAnimeTheme) by puckzxz, with additional violet glass design and compatibility work.

There is no official affiliation with Discord or Vencord.
