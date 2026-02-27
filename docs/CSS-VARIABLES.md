# Standard Notes CSS Variables Reference

SN themes inject CSS custom properties into editor iframes. Use them to make your editor adapt to any SN theme.

## How to Use Theme Variables

**Do NOT** declare `--sn-stylekit-*` variables in your CSS. SN injects those into the iframe. If you declare them, your values override SN's.

Instead, use CSS fallback syntax:

```css
:root {
  --my-bg: var(--sn-stylekit-background-color, #1a1a1f);
  --my-fg: var(--sn-stylekit-foreground-color, #e4e4e7);
  --my-border: var(--sn-stylekit-border-color, #27272a);
}
```

The fallback value (after the comma) is used when the variable is not set (standalone mode). When inside SN, the theme's values take precedence.

## How Themes Reach Your Editor

1. SN sends `component-registered` with `activeThemeUrls` (array of CSS file URLs)
2. Your editor loads those as `<link rel="stylesheet">` in `<head>`
3. The theme CSS sets `--sn-stylekit-*` variables on `:root`
4. SN sends `themes` action when the user changes themes

```typescript
private activateThemes(urls: string[]) {
  document.querySelectorAll('link[data-sn-theme]').forEach(el => el.remove());
  for (const url of urls) {
    if (!url) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-sn-theme', 'true');
    document.head.appendChild(link);
  }
}
```

## Primary Colors

| Variable | Purpose | Light Default | Dark Default |
|----------|---------|---------------|--------------|
| `--sn-stylekit-background-color` | Primary background | `#ffffff` | `#1e1e1e` |
| `--sn-stylekit-foreground-color` | Primary text | `#000000` | `#eeeeee` |
| `--sn-stylekit-border-color` | Borders on primary bg | `#dfe1e4` | `#4a4a4a` |
| `--sn-stylekit-shadow-color` | Box shadows | `#c8c8c8` | `#000000` |

## Contrast Colors (Sidebars, Panels)

| Variable | Purpose | Light Default |
|----------|---------|---------------|
| `--sn-stylekit-contrast-background-color` | Panel/sidebar bg | `#f6f6f6` |
| `--sn-stylekit-contrast-foreground-color` | Panel text | `#2e2e2e` |
| `--sn-stylekit-contrast-border-color` | Panel borders | `#e3e3e3` |

## Secondary Colors

| Variable | Purpose | Light Default |
|----------|---------|---------------|
| `--sn-stylekit-secondary-background-color` | Secondary bg | `#f6f6f6` |
| `--sn-stylekit-secondary-foreground-color` | Muted text | `#2e2e2e` |
| `--sn-stylekit-secondary-border-color` | Secondary borders | `#e3e3e3` |
| `--sn-stylekit-secondary-contrast-background-color` | Deep contrast bg | `#e3e3e3` |
| `--sn-stylekit-secondary-contrast-foreground-color` | Deep contrast text | `#2e2e2e` |

## Semantic / Status Colors

| Variable | Purpose | Default |
|----------|---------|---------|
| `--sn-stylekit-info-color` | Accent / info blue | `#086DD6` |
| `--sn-stylekit-info-contrast-color` | Text on info bg | `#ffffff` |
| `--sn-stylekit-info-backdrop-color` | Light info background | `#2b6fcf0f` |
| `--sn-stylekit-success-color` | Success green | `#007662` |
| `--sn-stylekit-success-contrast-color` | Text on success bg | `#ffffff` |
| `--sn-stylekit-warning-color` | Warning yellow | `#EBAD00` |
| `--sn-stylekit-warning-contrast-color` | Text on warning bg | `#ffffff` |
| `--sn-stylekit-danger-color` | Danger red | `#cc2128` |
| `--sn-stylekit-danger-contrast-color` | Text on danger bg | `#ffffff` |
| `--sn-stylekit-neutral-color` | Neutral / muted | `#989898` |

## Typography

| Variable | Purpose | Default |
|----------|---------|---------|
| `--sn-stylekit-font-size-base` | Base font size | `0.8125rem` |
| `--sn-stylekit-font-size-editor` | Editor content | `0.983125rem` |
| `--sn-stylekit-sans-serif-font` | Sans-serif stack | System fonts |
| `--sn-stylekit-monospace-font` | Monospace stack | SFMono, Consolas, etc. |

## Editor-Specific

| Variable | Purpose |
|----------|---------|
| `--sn-stylekit-editor-background-color` | Editor area background |
| `--sn-stylekit-editor-foreground-color` | Editor area text |
| `--sn-stylekit-editor-font-family` | Editor font family |
| `--sn-stylekit-paragraph-text-color` | Paragraph text |

## Form / Input

| Variable | Purpose | Default |
|----------|---------|---------|
| `--sn-stylekit-input-placeholder-color` | Placeholder text | `#a8a8a8` |
| `--sn-stylekit-input-border-color` | Input borders | `#e3e3e3` |

## Scrollbar

| Variable | Purpose |
|----------|---------|
| `--sn-stylekit-scrollbar-thumb-color` | Scrollbar thumb |
| `--sn-stylekit-scrollbar-track-border-color` | Scrollbar track border |

## Theme Metadata

| Variable | Values | Purpose |
|----------|--------|---------|
| `--sn-stylekit-theme-type` | `"light"` or `"dark"` | Current theme type |
| `--sn-stylekit-theme-name` | e.g., `"sn-light"` | Theme name |

## Passive Color Palette (Greys)

| Variable | Light Default | Purpose |
|----------|---------------|---------|
| `--sn-stylekit-passive-color-0` | `#515357` | Darkest grey |
| `--sn-stylekit-passive-color-1` | `#72767e` | |
| `--sn-stylekit-passive-color-2` | `#bbbec4` | |
| `--sn-stylekit-passive-color-3` | `#dfe1e4` | |
| `--sn-stylekit-passive-color-4` | `#eeeff1` | |
| `--sn-stylekit-passive-color-5` | `#f4f5f7` | |
| `--sn-stylekit-passive-color-6` | `#e5e5e5` | |
| `--sn-stylekit-passive-color-super-light` | `#f9f9f9` | Lightest |

## Accessory Tint Colors

For decorative accents, tags, etc.:

| Variable | Default Color |
|----------|---------------|
| `--sn-stylekit-accessory-tint-color-1` | `#086dd6` (blue) |
| `--sn-stylekit-accessory-tint-color-2` | `#ea6595` (pink) |
| `--sn-stylekit-accessory-tint-color-3` | `#ebad00` (gold) |
| `--sn-stylekit-accessory-tint-color-4` | `#7049cf` (purple) |
| `--sn-stylekit-accessory-tint-color-5` | `#1aa772` (teal) |
| `--sn-stylekit-accessory-tint-color-6` | `#f28c52` (orange) |

## Layout

| Variable | Default | Purpose |
|----------|---------|---------|
| `--sn-stylekit-general-border-radius` | `2px` | Standard border radius |

## Practical Example

A complete theme-aware CSS setup for an SN editor:

```css
:root {
  /* Map SN variables to your editor's tokens, with dark fallbacks */
  --editor-bg: var(--sn-stylekit-background-color, #1a1a1f);
  --editor-fg: var(--sn-stylekit-foreground-color, #e4e4e7);
  --editor-panel-bg: var(--sn-stylekit-contrast-background-color, #27272a);
  --editor-border: var(--sn-stylekit-border-color, #3f3f46);
  --editor-accent: var(--sn-stylekit-info-color, #6366f1);
  --editor-danger: var(--sn-stylekit-danger-color, #ef4444);
  --editor-muted: var(--sn-stylekit-secondary-foreground-color, #a1a1aa);
  --editor-hover: var(--sn-stylekit-secondary-background-color, #27272a);
}

body {
  font-family: var(--sn-stylekit-sans-serif-font, system-ui, sans-serif);
  font-size: var(--sn-stylekit-font-size-editor, 14px);
  color: var(--editor-fg);
  background: var(--editor-bg);
}

body.sn-embedded {
  background: transparent;
}

.card {
  background: var(--editor-bg);
  border: 1px solid var(--editor-border);
}

.card:hover {
  border-color: var(--editor-accent);
}

.button-primary {
  background: var(--editor-accent);
  color: var(--sn-stylekit-info-contrast-color, #fff);
}

.button-danger {
  background: var(--editor-danger);
  color: var(--sn-stylekit-danger-contrast-color, #fff);
}

/* Date inputs adapt to theme */
input[type="date"] {
  color-scheme: light dark;
}
```
