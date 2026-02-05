# GoldBack Web Application

This is the main web application for GoldBack, a fintech/crypto platform built on Solana.

## Tech Stack

- **Framework**: Next.js 16 with React 19
- **Styling**: Tailwind CSS v4 with PostCSS
- **Animations**: Framer Motion
- **Data Visualization**: D3.js v7
- **Blockchain**: Solana Web3.js, Wallet Adapter
- **Database**: Supabase, Prisma

## Project Structure

```
my-app/
├── src/
│   ├── app/
│   │   ├── app/           # Main authenticated app routes
│   │   │   ├── page.tsx       # Dashboard
│   │   │   ├── layout.tsx     # App shell with header
│   │   │   ├── profile/       # User profile & wallet
│   │   │   ├── swap/          # Token swap interface
│   │   │   └── vault/         # Vault visualization
│   │   └── globals.css    # Global styles & design tokens
│   ├── components/        # Shared UI components
│   └── styles/
│       └── design-tokens.css  # CSS custom properties
├── .claude/
│   └── skills/
│       └── design-system-guru.md  # Design skill
└── public/
    └── fonts/Matter/      # Custom font files
```

---

## Design System

The GoldBack Design System provides consistent, accessible, and beautiful UI patterns for the application.

### Design Skill

Use the `/design` skill (`.claude/skills/design-system-guru.md`) when:
- Creating new UI components
- Reviewing existing designs
- Generating Tailwind CSS code
- Ensuring design consistency

### Core Design Principles

1. **Dark-First Design** - Professional fintech aesthetic
2. **Gold/Amber Branding** - Trust, value, premium quality
3. **Accessibility** - WCAG AA compliance (4.5:1 contrast minimum)
4. **Performance** - Optimized animations, no layout thrashing
5. **Mobile Responsive** - Touch-first, adapt for desktop

---

## Color Palette

### Brand Colors (Gold/Amber)

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| gold-50 | #FFFBEB | `bg-gold-50` | Light backgrounds |
| gold-400 | #FBBF24 | `text-gold-400` | Hover states |
| gold-500 | #F59E0B | `bg-amber-500` | Primary CTA |
| gold-600 | #D97706 | `bg-amber-600` | Pressed states |
| gold-900 | #78350F | `bg-amber-900` | Dark accents |

### Status Colors

| Status | Color | Tailwind | Contrast |
|--------|-------|----------|----------|
| Success | #22C55E | `text-green-500` | 4.52:1 |
| Warning | #EAB308 | `text-yellow-500` | 5.26:1 |
| Error | #EF4444 | `text-red-500` | 4.53:1 |
| Info | #3B82F6 | `text-blue-500` | 4.51:1 |

### Surface Colors

| Surface | Hex | Tailwind |
|---------|-----|----------|
| Background | #0A0A0A | `bg-[#0A0A0A]` |
| Surface | #111111 | `bg-gray-900` |
| Elevated | #1A1A1A | `bg-[#1A1A1A]` |
| Hover | #262626 | `bg-gray-800` |

---

## Typography

### Font Family

**Matter** - Custom font with weights 300-900

```css
font-family: 'Matter', -apple-system, BlinkMacSystemFont, sans-serif;
```

### Type Scale

| Name | Size | Tailwind | Usage |
|------|------|----------|-------|
| Display | 48px | `text-5xl font-bold` | Hero sections |
| H1 | 36px | `text-4xl font-bold` | Page titles |
| H2 | 30px | `text-3xl font-semibold` | Section titles |
| H3 | 24px | `text-2xl font-semibold` | Card titles |
| H4 | 20px | `text-xl font-medium` | Subsections |
| Body | 16px | `text-base` | Paragraphs |
| Small | 14px | `text-sm` | Captions |
| Micro | 12px | `text-xs font-medium` | Labels, badges |

---

## Spacing System

8px base grid with 4px half-steps.

| Token | Value | Tailwind |
|-------|-------|----------|
| 1 | 4px | `p-1`, `m-1`, `gap-1` |
| 2 | 8px | `p-2`, `m-2`, `gap-2` |
| 3 | 12px | `p-3`, `m-3`, `gap-3` |
| 4 | 16px | `p-4`, `m-4`, `gap-4` |
| 6 | 24px | `p-6`, `m-6`, `gap-6` |
| 8 | 32px | `p-8`, `m-8`, `gap-8` |

---

## Component Patterns

### Cards

```html
<!-- Base Card -->
<div class="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors">

<!-- Gold Accent Card -->
<div class="bg-gradient-to-br from-amber-900/20 to-gray-900 border border-amber-500/30 rounded-2xl p-6">
```

### Buttons

```html
<!-- Primary -->
<button class="bg-amber-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-amber-400 transition-colors">

<!-- Secondary -->
<button class="bg-gray-800 text-white font-medium px-6 py-3 rounded-xl hover:bg-gray-700 border border-gray-700 transition-colors">

<!-- Ghost -->
<button class="text-gray-400 hover:text-white font-medium px-4 py-2 hover:bg-gray-800/50 rounded-lg transition-colors">
```

### Status Badges

```html
<!-- Success -->
<span class="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-medium">

<!-- Warning -->
<span class="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-medium">

<!-- Error -->
<span class="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-medium">
```

### Form Inputs

```html
<input class="w-full bg-transparent border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors">
```

---

## Animation Patterns

### Framer Motion Presets

```tsx
// Fade In Up (Default entrance)
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 }
}

// Stagger Children
const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } }
}

// Scale on Hover
const scaleOnHover = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 }
}
```

### CSS Animations

```css
/* Pulse Glow */
.animate-pulse { animation: pulse 4s infinite; }

/* Slow Spin */
.animate-spin-slow { animation: spin 20s linear infinite; }
```

---

## Accessibility Checklist

- [ ] Text contrast meets WCAG AA (4.5:1 minimum)
- [ ] Interactive elements are keyboard accessible
- [ ] Focus indicators are visible (gold ring)
- [ ] Semantic HTML used (`<button>`, `<nav>`, `<main>`)
- [ ] `aria-label` on icon-only buttons
- [ ] Reduced motion support via `prefers-reduced-motion`

---

## File References

| File | Purpose |
|------|---------|
| `src/styles/design-tokens.css` | CSS custom properties |
| `src/app/globals.css` | Global styles + Tailwind theme |
| `.claude/skills/design-system-guru.md` | Design skill with patterns |

---

## Development Guidelines

### Creating New Components

1. Check the design skill for existing patterns
2. Use design tokens for colors, spacing, typography
3. Follow the card/button/badge patterns above
4. Add Framer Motion animations for entrances
5. Test for accessibility (contrast, keyboard nav)

### Modifying Styles

1. Add new tokens to `design-tokens.css` first
2. Extend Tailwind theme in `globals.css` if needed
3. Update CLAUDE.md documentation
4. Keep the design skill in sync

### Performance Tips

- Use `transition-colors` not `transition-all`
- Prefer `transform` and `opacity` for animations
- Use `will-change` sparingly
- Implement `prefers-reduced-motion` checks
