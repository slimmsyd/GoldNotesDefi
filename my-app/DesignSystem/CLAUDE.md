# Obsidian Shield Design System

This is the official design system for the BlackW3B / Obsidian Shield application. It embodies a "Matrix Noir" aesthetic, fusing terminal-style precision with gold-backed trust.

## Design Philosophy

- **Matrix Noir**: Red binary cascades, terminal grids, monospace precision.
- **Gold Standard**: Metallic gold accents representing physical Goldback backing.
- **Shield Security**: Angular geometries, sharp corners, fortress-like UI elements.

---

## Color Palette

### Primary Colors

| Token | Hex | Tailwind Class | Usage |
|-------|-----|----------------|-------|
| **Obsidian Black** | `#0a0a0a` | `bg-[#0a0a0a]` | Primary background, infinite depth |
| **Matrix Red** | `#ff0000` | `text-[#ff0000]` | Binary code, warning, error |
| **Gold Light** | `#e8d48b` | `text-[#e8d48b]` | Headlines, gold text on dark bg |
| **Gold Primary** | `#c9a84c` | `text-[#c9a84c]` | Button gradient start, accents |
| **Gold Deep** | `#a48a3a` | `text-[#a48a3a]` | Button gradient end, hover states |
| **Terminal Green** | `#00ff00` | `text-[#00ff00]` | Success states, verification |

### Secondary Colors

| Token | Hex | Tailwind Class | Usage |
|-------|-----|----------------|-------|
| **Vault Gray** | `#1a1a1a` | `bg-[#1a1a1a]` | Secondary backgrounds, cards |
| **Circuit Gold** | `#b8860b` | `border-[#b8860b]` | Borders, dividers, inactive |
| **Ghost White** | `#f5f5f5` | `text-[#f5f5f5]` | Primary text, headings |
| **Proof White** | `#ffffff` | `text-white` | High-emphasis text |

### Inverted Mode (on-scroll)

When the header (or any component) inverts on scroll, swap to:

| Element | Dark Mode | Inverted (Light) |
|---------|-----------|-------------------|
| Background | `#0a0a0a` | `#ffffff` |
| Text | `text-gray-300` | `text-gray-700` |
| Borders | `border-[#d4af37]/30` | `border-gray-200` |
| CTA Button | Gold gradient | Solid black |

---

## Core Rules

### 1. All corners are sharp

Every UI element uses `rounded-none` (0px border-radius). No pills, no rounded corners. This is non-negotiable -- it defines the Obsidian Shield identity.

### 2. Gold is the accent, black is the canvas

Gold (`#d4af37` to `#ffd700`) is reserved for CTAs, active states, and emphasis. The primary surface is always obsidian black or vault gray.

### 3. Transitions are fast and decisive

- Button press: `active:scale-95` (instant feedback)
- Color transitions: `duration-150` (crisp, no lag)
- Menu animations: 250-300ms with smooth easing `[0.25, 0.1, 0.25, 1]`

---

## Button System

All buttons share: `font-bold text-sm transition-all cursor-pointer active:scale-95 rounded-none`

### Primary (Gold CTA)

The hero action. Muted gold gradient, darkens right. Black text.

```html
<button class="bg-linear-to-r from-[#c9a84c] to-[#a48a3a] text-black font-bold px-8 py-3 hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_16px_rgba(201,168,76,0.35)]">
  ACTION
</button>
```

### Secondary (Dark Glass)

Supporting action. Dark background with subtle gold border and gold text.

```html
<button class="bg-[#0a0a0a]/80 border border-[#c9a84c]/40 text-[#e8d48b] font-semibold px-8 py-3 hover:bg-[#0a0a0a] hover:border-[#c9a84c]/60 backdrop-blur-sm active:scale-95 transition-all">
  SECONDARY
</button>
```

### Tertiary (Solid Black)

Used in inverted/light contexts.

```html
<button class="bg-[#0a0a0a] text-white font-bold px-8 py-3 hover:bg-[#1a1a1a] transition-colors active:scale-95">
  ACTION
</button>
```

### Ghost (Text Only)

Minimal emphasis. Gold text on hover.

```html
<button class="text-gray-300 font-medium px-4 py-2 hover:text-[#d4af37] transition-colors">
  Link
</button>
```

### Danger (Destructive)

```html
<button class="bg-[#ff0000] text-white font-bold px-8 py-3 hover:bg-red-600 transition-colors active:scale-95">
  DELETE
</button>
```

### Button Sizes

| Size | Classes | Usage |
|------|---------|-------|
| **sm** | `h-8 px-4 text-xs` | Header, inline actions |
| **default** | `h-10 px-6 text-sm` | Standard buttons |
| **lg** | `h-12 px-10 text-base` | Hero CTAs, full-width |

---

## Component Patterns

### Cards

All cards use sharp corners (`rounded-none`).

**Standard Card**
```html
<div class="bg-[#1a1a1a] border border-[#d4af37]/30 p-6 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
  <!-- Content -->
</div>
```

**Gold Accent Card**
```html
<div class="bg-[#1a1a1a] border-2 border-[#d4af37] p-4">
  <!-- High-emphasis content -->
</div>
```

### Inputs

```html
<input class="w-full bg-[#1a1a1a]/80 border border-[#d4af37] text-white p-3 placeholder-white/40 focus:border-[#ffd700] focus:shadow-[0_0_8px_rgba(212,175,55,0.5)] outline-none transition-all" />
```

### Badges

```html
<span class="text-[10px] px-2 py-0.5 uppercase font-mono bg-[#d4af37]/20 text-[#d4af37]">
  VERIFIED
</span>
```

---

## Typography

### Font Families

- **Headings**: `Orbitron` (Weights: 700, 900)
- **Body**: `Inter` (Weights: 400, 500, 600)
- **Monospace**: `JetBrains Mono` (Weights: 400, 700)

### Type Scale

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Display | 32px | 900 | Onboarding titles |
| H1 | 24px | 700 | Screen titles |
| H2 | 20px | 700 | Section headers |
| Body | 14px | 400 | Standard text |
| Mono | 14px | 400 | Serial numbers, hashes |

---

## Animation Patterns

### Transitions
- **Button Press**: `active:scale-95` (instant)
- **Color Swap**: `duration-150 ease-out` (crisp)
- **Card Entrance**: `translateY(20px) -> 0`, `opacity 0 -> 1` (250ms)
- **Menu Slide**: `duration-300 ease [0.25, 0.1, 0.25, 1]`
- **Stagger Children**: `60ms` delay between items

### Vignette Overlay (Hero / Full-bleed sections)

Diagonal gradient from subtle to deep black. Creates premium, moody depth over background images.

```css
background: linear-gradient(147deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.6) 60%, rgba(0, 0, 0, 0.8) 100%);
```

### Gold Text Gradient

For headings on dark backgrounds. Light gold fading to primary gold.

```css
background-image: linear-gradient(to right, #e8d48b, #c9a84c);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

### Matrix Binary Cascade
- **Effect**: Red (`#ff0000`) binary characters cascading down
- **Opacity**: 10-20%
- **Speed**: 3-5s per screen height
