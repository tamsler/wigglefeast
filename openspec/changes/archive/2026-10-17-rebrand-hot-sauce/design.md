# Design

## Context

- **Current styles** (`style.css`):
  - the wordmark gradient is `linear-gradient(90deg, #ff595e, #ffca3a, #8ac926, #4cc9f0)`
  - `button.primary` and `#updateReload` share `linear-gradient(90deg, #8ac926, #2ec4b6)` with dark text `#10142a` and a 3D shadow `#1b7f6c`
  - there are no colour tokens; colours are literals
- **Icons** (`icons/`): `icon-192.png`, `icon-512.png` (also declared maskable in the manifest), `apple-touch-icon.png` (180 px) and `favicon-64.png`. They were added by hand in the first commit; there's no script.
- **Manifest and theme:** `manifest.webmanifest` and `index.html` set the theme and background colour to `#0b0f1c`.
- **Test helper:** `tests/helpers/browser.js` can already launch headless Chrome and evaluate code in a page.
- **Release check:** `check-version.sh` exempts `README.md`, `LICENSE`, `.gitignore`, `openspec/`, `.github/`, `.claude/` and `tests/` from the version bump.

## Goals / Non-Goals

**Goals:**
- One place to change the brand colours.
- Icons reproducible from the repo, so a later tweak doesn't need a design tool.

**Non-Goals:**
- Theming every accent. Cyan stays the secondary accent.

## Decisions

### 1. Brand tokens in `style.css`, used by the wordmark and primary buttons
- **Tokens:** add a `:root` block with `--brand-a: #ff2e88`, `--brand-b: #ff9f1c`, `--brand-ink: #1a0612` (dark text on the gradient) and `--brand-shadow: #a3134f` (the pressed 3D edge).
- **Usage:** `h1 span`, `button.primary` and `#updateReload` use `linear-gradient(90deg, var(--brand-a), var(--brand-b))`, with dark text.
- **Contrast:** `#1a0612` on `#ff2e88` is about 5.3:1, and higher on the orange end, which is enough for the bold button labels.
- **Play here** already uses `button.primary`, so it follows automatically.

*Alternative:* white text on the gradient. Rejected: about 3.4:1 on the pink end.

### 2. Icons drawn by a script with headless Chrome: `tools/make-icons.js`
- **What it does:** the script launches Chrome through `tests/helpers/browser.js` and draws each icon on a canvas, with the same proportions as the current icon:
  - the navy arena
  - a soft pink glow behind the worm
  - a curl of radius 0.27 × size, worm radius 0.11 × size, in the brand gradient from head to tail, with a dark outline, gloss and eyes
  - a few food dots in the brand colours
- **Output:** it writes the PNGs with `canvas.toDataURL`, so no image library is needed.
- **Safe zone:** the curl plus the body reaches 0.38 × size from the centre, inside the 0.40 maskable safe zone.
- **Favicon:** the 64-pixel favicon skips the food dots and uses a thicker outline, so it reads at small size.
- **Why `tools/`:** it isn't part of the game, so `check-version.sh` adds `tools/` to its exempt paths (the rule and its test are updated). The script reuses the test helper rather than duplicating Chrome setup.

*Alternatives:*
- Hand-drawn SVG icons: rejected, because the manifest needs PNGs, and converting SVG to PNG without dependencies isn't possible here.
- Committing images made in an external tool: rejected, because they can't be reproduced.

### 3. Theme colour unchanged
The status bar stays `#0b0f1c`, so it blends with the arena. A pink bar over the game would be loud and would clash with the dark HUD.

## Risks / Trade-offs

- **iOS home-screen icons don't update** until the app is removed and added again. → This is a platform limit, noted in the README; the next manual check uses a fresh install.
- **Chrome renders the canvas, so icons may differ by a pixel** between machines or versions. → Icons are generated once and committed; the script exists to make a deliberate regeneration possible, not to run in CI.
- **Brand pink and orange are close to some food colours** (the `#f72585` and `#ff9f1c` food). → Food is small, glowing dots; the brand appears in the UI, not in the arena. No conflict in play.

## Migration Plan

No data changes. Bump `VERSION` (minor) so installed copies pick up the new styles and icons. To roll back, publish the previous code under a higher version.
