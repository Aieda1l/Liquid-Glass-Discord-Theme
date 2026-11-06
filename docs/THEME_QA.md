# Reze Boom — Liquid Glass UI QA matrix

Version: **4.2.4**. This is a manual verification checklist, not evidence that Discord was rendered or that all items passed. Use the latest Windows Discord/Vencord build with this theme alone, then repeat important checks with other plugins enabled.

## Must-pass screenshot regressions

| Area | Intended behavior | What would be a failure |
| --- | --- | --- |
| DM/server chat history | Wallpaper recognizable through a 6px blur; messages legible | 18px+ smeared image, text itself blurred, opaque black pane |
| Message input | Translucent outlined capsule, text/cursor and action buttons usable | Solid gray inner container, clipped emoji picker, lost focus |
| Quest bar | Translucent card, readable text, clickable claim button | Opaque fill, masked reward button or card overflowing sidebar |
| Folder buttons | Wet-glass tile, folder glyph and mini-server previews centered | Icon resizing, shifted mini-icons, clipped folder thumbnails |
| Expanded folder | Frosted vertical backing, native open/close animation | Folder content clipped, blank background, overlay blocking clicks |
| Server icon hover | Bright animated violet halo on the server icon artwork only | White unread dot / badges glowing, or the server list row changing geometry |
| Unread/selected guild | White pill, red notification badge and normal hover behavior | Duplicate white dots, shifted marker or modified badges |
| Server-name tooltip hover | One glass container with legible title/details | Duplicate rectangular outline or inset glass frame |
| Small name tooltip (e.g. Ash) | Single tooltip outline, text fully readable | A second border around the label |
| Quest card over the DM list | Readable date/title/action with glass tint blocking underlying text | Ghosted second date, DM/user text bleeding through, multiple borders |
| User mic/headphone dropdowns | Native compact chevron hit target inside shared panel | Independent extra pill from global button styling |

## Broad UI surface checklist

- [ ] Guild home, servers, folder open/close, hovered and selected states, unread dots and notification counts
- [ ] Left DM sidebar, channel list and search pill
- [ ] Chat history, scrolling, mention tags, replies, edited messages, embeds, attachments, inline/code blocks, reactions and polls
- [ ] Composer, typing indicator, emoji, sticker and GIF pickers, attachment upload
- [ ] Header toolbar, search/results panel, member sidebar and voice call state
- [ ] User profile popout, expanded profile, messages menu and context menu
- [ ] Quest bar, reward actions, promotions and popups
- [ ] Friends list, active-now cards and user panel
- [ ] Settings content cards, switches, sliders, popovers, focus and keyboard interactions
- [ ] Forced-colors, Windows reduced motion and different window sizes / display scaling

## Performance and selector safety

- No extra pseudo-elements on guild `listItem_`, including `::before`/`::after`.
- Tooltip glass must decorate the outer `[role="tooltip"]` once; inner `tooltipContent_` has no border or blur.
- Quest glass must decorate the `[data-testid="quest-bar-container"]` once, with a sufficient opacity to obscure content behind it.
- Avoid universal `button[class*="button_"]` background-image/box-shadow and preserve native dropdown controls.
- No global animation/transform/filter on generic server `wrapper_` elements.
- No generic `[class*="folder_"]` modifications; only dedicated folder surfaces.
- No per-message backdrop filters; one shared `chatContent_` blur.
- Animated purple glow only while hovering/focusing an actual server icon; selected server retains a static ring, and no animation runs when idle.
- Reduced-motion mode retains a static purple ring without animation; folders remain excluded from the halo.
- Blur and surface styling should not intercept pointer or keyboard events.

## How to verify a Discord UI regression

1. In **User Settings → Vencord → Themes**, temporarily disable all other themes and remove any experimental QuickCSS overrides.
2. Restart Discord (or press `Ctrl+R`); re-enable the updated `RezeBoom.theme.css`.
3. Capture the affected area before changing selectors. Check both normal and hovered state.
4. If a selector has stopped matching after Discord updates, collect an anonymized DevTools class hierarchy for the affected wrapper, *not* chat message contents or personal account data.
5. Add a narrowly scoped selector plus a regression test. Don't clear backgrounds with a universal `*` rule, and don't override unread/selection indicators to hide a styling bug.

**Important:** Automated PostCSS tests only establish syntax, metadata and selected selector invariants; they do not validate the full Discord DOM or GPU-rendered appearance.
