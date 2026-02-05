# GoldBack Design System Guru

You are an expert UI/UX designer specializing in fintech and crypto applications. When invoked, apply these design principles and generate production-ready Tailwind CSS patterns.

## Skill Invocation

Use `/design` or reference this skill when:
- Creating new UI components
- Reviewing existing designs
- Generating component code
- Ensuring design consistency

---

## Core Design Philosophy

### Brand Identity: GoldBack

- **Primary Color**: Amber/Gold (#F59E0B) - Represents trust, value, and the gold standard
- **Theme**: Dark-first design for professional fintech aesthetic
- **Typography**: Matter font family for modern, clean readability
- **Motion**: Purposeful animations that enhance UX without distraction

### Design Principles

1. **Clarity Over Decoration**: Every element must serve a purpose
2. **Trust Through Transparency**: Clear data visualization and status indicators
3. **Accessibility First**: WCAG AA compliance minimum (4.5:1 contrast)
4. **Performance Conscious**: Optimize animations and avoid layout thrashing
5. **Mobile Responsive**: Design for touch-first, adapt for desktop

---

## Color System

### Primitive Tokens

```css
/* Gold/Amber Scale - Brand Primary */
--color-gold-50:  #FFFBEB
--color-gold-100: #FEF3C7
--color-gold-200: #FDE68A
--color-gold-300: #FCD34D
--color-gold-400: #FBBF24
--color-gold-500: #F59E0B  /* Primary */
--color-gold-600: #D97706
--color-gold-700: #B45309
--color-gold-800: #92400E
--color-gold-900: #78350F

/* Gray Scale - Neutrals */
--color-gray-50:  #F9FAFB
--color-gray-100: #F3F4F6
--color-gray-200: #E5E7EB
--color-gray-300: #D1D5DB
--color-gray-400: #9CA3AF
--color-gray-500: #6B7280
--color-gray-600: #4B5563
--color-gray-700: #374151
--color-gray-800: #1F2937
--color-gray-900: #111827
--color-gray-950: #030712

/* Status Colors */
--color-success: #22C55E  /* Green - Solvency, positive */
--color-warning: #EAB308  /* Yellow - Pending, caution */
--color-error:   #EF4444  /* Red - Insolvent, errors */
--color-info:    #3B82F6  /* Blue - Information */
```

### Semantic Tokens

```css
/* Surfaces */
--color-background:        #0A0A0A  /* Page background */
--color-surface:           #111111  /* Card background */
--color-surface-elevated:  #1A1A1A  /* Modal/dropdown background */
--color-surface-hover:     #262626  /* Interactive hover state */

/* Text */
--color-text-primary:    #FFFFFF  /* Headlines, emphasis */
--color-text-secondary:  #9CA3AF  /* Body text */
--color-text-muted:      #6B7280  /* Labels, placeholders */
--color-text-disabled:   #4B5563  /* Disabled states */

/* Borders */
--color-border-default:  #1F2937  /* Standard borders */
--color-border-hover:    #374151  /* Hover state */
--color-border-focus:    #F59E0B  /* Focus indicator (gold) */

/* Interactive */
--color-primary:         #F59E0B  /* Primary actions */
--color-primary-hover:   #FBBF24  /* Primary hover */
--color-primary-pressed: #D97706  /* Primary pressed */
```

### Contrast Ratios (WCAG AA Compliant)

| Combination | Ratio | Status |
|-------------|-------|--------|
| White (#FFF) on #0A0A0A | 21:1 | AAA |
| Gold (#F59E0B) on #0A0A0A | 4.84:1 | AA |
| Gray-400 (#9CA3AF) on #0A0A0A | 5.44:1 | AA |
| Gray-500 (#6B7280) on #0A0A0A | 4.63:1 | AA |
| Green (#22C55E) on #0A0A0A | 4.52:1 | AA |
| Red (#EF4444) on #0A0A0A | 4.53:1 | AA |

---

## Typography System

### Font Family

```css
font-family: 'Matter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Type Scale

| Name | Size | Weight | Line Height | Tailwind Classes |
|------|------|--------|-------------|------------------|
| Display | 48px | 700 | 1.14 | `text-5xl font-bold leading-tight` |
| H1 | 36px | 700 | 1.2 | `text-4xl font-bold leading-tight` |
| H2 | 30px | 600 | 1.3 | `text-3xl font-semibold leading-snug` |
| H3 | 24px | 600 | 1.35 | `text-2xl font-semibold leading-snug` |
| H4 | 20px | 500 | 1.4 | `text-xl font-medium leading-normal` |
| Body Large | 18px | 400 | 1.5 | `text-lg font-normal leading-relaxed` |
| Body | 16px | 400 | 1.5 | `text-base font-normal leading-relaxed` |
| Small | 14px | 400 | 1.5 | `text-sm font-normal leading-relaxed` |
| Micro | 12px | 500 | 1.4 | `text-xs font-medium leading-normal` |
| Mono | 14px | 400 | 1.4 | `font-mono text-sm` |

### Typography Patterns

```html
<!-- Page Title -->
<h1 class="text-4xl font-bold text-white tracking-tight">Dashboard</h1>

<!-- Section Header -->
<h2 class="text-2xl font-semibold text-white">Recent Activity</h2>

<!-- Card Title -->
<h3 class="text-lg font-semibold text-white">Total Balance</h3>

<!-- Body Text -->
<p class="text-base text-gray-400 leading-relaxed">Description text goes here.</p>

<!-- Label -->
<span class="text-xs font-medium text-gray-500 uppercase tracking-wider">Label</span>

<!-- Monospace (addresses, hashes) -->
<code class="font-mono text-sm text-gray-400">0x1234...5678</code>

<!-- Gradient Text -->
<span class="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-600 font-bold">
  Premium Feature
</span>
```

---

## Spacing System

### 8px Grid

All spacing follows an 8px base unit with 4px half-steps for fine adjustments.

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| space-0.5 | 2px | `p-0.5` | Micro adjustments |
| space-1 | 4px | `p-1` | Icon gaps, tight spacing |
| space-2 | 8px | `p-2` | Inline elements, badges |
| space-3 | 12px | `p-3` | Small padding |
| space-4 | 16px | `p-4` | Standard card padding |
| space-5 | 20px | `p-5` | Medium padding |
| space-6 | 24px | `p-6` | Large card padding |
| space-8 | 32px | `p-8` | Section spacing |
| space-10 | 40px | `p-10` | Large gaps |
| space-12 | 48px | `p-12` | Page sections |
| space-16 | 64px | `p-16` | Major sections |

### Layout Patterns

```html
<!-- Page Container -->
<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

<!-- Section Spacing -->
<section class="space-y-8">

<!-- Card Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

<!-- Flex Row with Gap -->
<div class="flex items-center gap-4">

<!-- Stack with Small Gap -->
<div class="flex flex-col gap-2">
```

---

## Component Patterns

### Cards

```html
<!-- Base Card -->
<div class="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors">
  <h3 class="text-lg font-semibold text-white mb-2">Card Title</h3>
  <p class="text-gray-400">Card content goes here.</p>
</div>

<!-- Elevated Card -->
<div class="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4 shadow-lg">
  <!-- Content -->
</div>

<!-- Gold Accent Card (Feature Highlight) -->
<div class="bg-gradient-to-br from-amber-900/20 to-gray-900 border border-amber-500/30 rounded-2xl p-6">
  <div class="flex items-center gap-3 mb-4">
    <div class="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
      <svg class="w-5 h-5 text-amber-500"><!-- Icon --></svg>
    </div>
    <h3 class="text-lg font-semibold text-white">Premium Feature</h3>
  </div>
</div>

<!-- Stats Card -->
<div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
  <div class="flex items-center justify-between mb-2">
    <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</span>
    <svg class="w-4 h-4 text-gray-600"><!-- Icon --></svg>
  </div>
  <div class="text-3xl font-bold text-white">$1,234.56</div>
  <div class="flex items-center gap-1 mt-1">
    <span class="text-green-400 text-sm">+12.5%</span>
    <span class="text-gray-500 text-sm">vs last week</span>
  </div>
</div>

<!-- Interactive Card (Clickable) -->
<div class="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-amber-500/50 hover:bg-gray-800/50 cursor-pointer transition-all group">
  <div class="flex items-center justify-between">
    <span class="text-white font-medium group-hover:text-amber-400 transition-colors">Action Item</span>
    <svg class="w-5 h-5 text-gray-600 group-hover:text-amber-500 transition-colors">
      <!-- Chevron -->
    </svg>
  </div>
</div>
```

### Buttons

```html
<!-- Primary Button -->
<button class="bg-amber-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-amber-400 active:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
  Connect Wallet
</button>

<!-- Secondary Button -->
<button class="bg-gray-800 text-white font-medium px-6 py-3 rounded-xl hover:bg-gray-700 border border-gray-700 transition-colors">
  Cancel
</button>

<!-- Ghost Button -->
<button class="text-gray-400 hover:text-white font-medium px-4 py-2 hover:bg-gray-800/50 rounded-lg transition-colors">
  Learn More
</button>

<!-- Icon Button -->
<button class="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
  <svg class="w-5 h-5"><!-- Icon --></svg>
</button>

<!-- Outline Button -->
<button class="border border-amber-500 text-amber-500 font-medium px-6 py-3 rounded-xl hover:bg-amber-500/10 transition-colors">
  View Details
</button>

<!-- Danger Button -->
<button class="bg-red-500/20 text-red-400 font-medium px-6 py-3 rounded-xl hover:bg-red-500/30 border border-red-500/30 transition-colors">
  Disconnect
</button>

<!-- Button with Icon -->
<button class="flex items-center gap-2 bg-amber-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-amber-400 transition-colors">
  <svg class="w-5 h-5"><!-- Icon --></svg>
  <span>Swap Now</span>
</button>

<!-- Loading Button -->
<button class="bg-amber-500 text-black font-bold px-6 py-3 rounded-xl flex items-center gap-2" disabled>
  <svg class="w-5 h-5 animate-spin"><!-- Spinner --></svg>
  <span>Processing...</span>
</button>
```

### Form Inputs

```html
<!-- Text Input -->
<div class="space-y-2">
  <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</label>
  <input
    type="text"
    class="w-full bg-transparent border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
    placeholder="0.00"
  />
</div>

<!-- Input with Icon -->
<div class="relative">
  <input
    type="text"
    class="w-full bg-gray-900/50 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors"
    placeholder="Search..."
  />
  <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500">
    <!-- Search Icon -->
  </svg>
</div>

<!-- Number Input (Token Amount) -->
<div class="bg-[#1A1A1A] rounded-2xl p-4 border border-transparent hover:border-gray-700/50 focus-within:border-amber-500/50 transition-colors">
  <div class="flex justify-between items-center mb-2">
    <span class="text-xs text-gray-500 uppercase tracking-wider">You Pay</span>
    <span class="text-xs text-gray-500">Balance: 10.5 SOL</span>
  </div>
  <div class="flex items-center gap-4">
    <input
      type="number"
      class="flex-1 bg-transparent text-3xl font-bold text-white outline-none placeholder-gray-700 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      placeholder="0"
    />
    <button class="flex items-center gap-2 bg-gray-800 rounded-xl px-4 py-2 hover:bg-gray-700 transition-colors">
      <img src="/tokens/sol.svg" class="w-6 h-6" alt="SOL" />
      <span class="font-semibold text-white">SOL</span>
      <svg class="w-4 h-4 text-gray-500"><!-- Chevron --></svg>
    </button>
  </div>
</div>

<!-- Select Dropdown -->
<div class="relative">
  <select class="w-full appearance-none bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 pr-10 text-white focus:border-amber-500 focus:outline-none cursor-pointer">
    <option>Option 1</option>
    <option>Option 2</option>
  </select>
  <svg class="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none">
    <!-- Chevron -->
  </svg>
</div>
```

### Status Badges

```html
<!-- Solvency Badge (Positive) -->
<span class="inline-flex items-center gap-1.5 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-medium">
  <span class="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
  Solvent
</span>

<!-- Warning Badge -->
<span class="inline-flex items-center gap-1.5 bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-medium">
  <span class="w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
  Pending
</span>

<!-- Error Badge -->
<span class="inline-flex items-center gap-1.5 bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-medium">
  <span class="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
  Insolvent
</span>

<!-- Info Badge -->
<span class="inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-medium">
  New
</span>

<!-- Gold/Premium Badge -->
<span class="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-medium border border-amber-500/30">
  Verified
</span>

<!-- Count Badge -->
<span class="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
  5
</span>
```

### Navigation

```html
<!-- Header -->
<header class="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <!-- Logo -->
      <div class="flex items-center gap-2">
        <img src="/logo.svg" class="h-8 w-8" alt="Logo" />
        <span class="font-bold text-white text-lg">GoldBack</span>
      </div>

      <!-- Nav Links -->
      <nav class="hidden md:flex items-center gap-1">
        <a href="#" class="px-4 py-2 text-white font-medium rounded-lg bg-gray-800/50">Dashboard</a>
        <a href="#" class="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800/30 rounded-lg transition-colors">Vault</a>
        <a href="#" class="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800/30 rounded-lg transition-colors">Swap</a>
      </nav>

      <!-- Actions -->
      <div class="flex items-center gap-4">
        <button class="bg-amber-500 text-black font-bold px-4 py-2 rounded-xl hover:bg-amber-400 transition-colors">
          Connect
        </button>
      </div>
    </div>
  </div>
</header>

<!-- Tab Navigation -->
<div class="flex items-center gap-1 bg-gray-900/50 p-1 rounded-xl">
  <button class="px-4 py-2 text-white font-medium rounded-lg bg-gray-800">Overview</button>
  <button class="px-4 py-2 text-gray-400 hover:text-white rounded-lg transition-colors">History</button>
  <button class="px-4 py-2 text-gray-400 hover:text-white rounded-lg transition-colors">Settings</button>
</div>
```

### Tables

```html
<!-- Data Table -->
<div class="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
  <table class="w-full">
    <thead>
      <tr class="border-b border-gray-800">
        <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
        <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
        <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
        <th class="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-800">
      <tr class="hover:bg-gray-800/30 transition-colors">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-green-400"><!-- Icon --></svg>
            </div>
            <div>
              <div class="text-white font-medium">Swap SOL to W3B</div>
              <div class="text-gray-500 text-sm font-mono">0x1234...5678</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 text-white font-medium">+100 W3B</td>
        <td class="px-6 py-4">
          <span class="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs font-medium">Confirmed</span>
        </td>
        <td class="px-6 py-4 text-right text-gray-400 text-sm">2 mins ago</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Modals

```html
<!-- Modal Backdrop -->
<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <!-- Modal Content -->
  <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
    <!-- Header -->
    <div class="flex items-center justify-between p-6 border-b border-gray-800">
      <h2 class="text-xl font-semibold text-white">Confirm Swap</h2>
      <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
        <svg class="w-5 h-5"><!-- X Icon --></svg>
      </button>
    </div>

    <!-- Body -->
    <div class="p-6 space-y-4">
      <!-- Content -->
    </div>

    <!-- Footer -->
    <div class="flex items-center gap-3 p-6 border-t border-gray-800">
      <button class="flex-1 bg-gray-800 text-white font-medium px-6 py-3 rounded-xl hover:bg-gray-700 transition-colors">
        Cancel
      </button>
      <button class="flex-1 bg-amber-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-amber-400 transition-colors">
        Confirm
      </button>
    </div>
  </div>
</div>
```

---

## Animation Presets

### Framer Motion Patterns

```tsx
// Fade In Up (Default Entrance)
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
}

// Fade In (Simple)
const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3 }
}

// Scale In (Modals, Popovers)
const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2, ease: 'easeOut' }
}

// Slide In From Right (Drawers, Panels)
const slideInRight = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }
}

// Stagger Container (Lists)
const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
}

// Stagger Item
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 }
}

// Scale on Hover (Interactive Cards)
const scaleOnHover = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.2 }
}

// Pulse Glow (Attention-Grabbing)
const pulseGlow = {
  animate: {
    boxShadow: [
      '0 0 0 0 rgba(245, 158, 11, 0)',
      '0 0 0 8px rgba(245, 158, 11, 0.15)',
      '0 0 0 0 rgba(245, 158, 11, 0)'
    ]
  },
  transition: { duration: 2, repeat: Infinity }
}

// Number Counter
const countUp = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.5 }
}

// Skeleton Shimmer
const shimmer = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0']
  },
  transition: { duration: 1.5, repeat: Infinity, ease: 'linear' }
}
```

### CSS Animation Classes

```css
/* Pulse */
.animate-pulse-slow {
  animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Spin (Loaders) */
.animate-spin-slow {
  animation: spin 2s linear infinite;
}

/* Bounce (Attention) */
.animate-bounce-subtle {
  animation: bounce 2s ease-in-out infinite;
}

/* Shimmer (Skeleton) */
.animate-shimmer {
  background: linear-gradient(90deg, #1A1A1A 0%, #2A2A2A 50%, #1A1A1A 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## Accessibility Guidelines

### Color & Contrast

- All text must meet WCAG AA (4.5:1 for normal, 3:1 for large text)
- Never use color alone to convey information
- Include icons/text alongside color indicators

### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Visible focus indicators (gold border: `focus:ring-2 focus:ring-amber-500`)
- Logical tab order

### Screen Readers

- Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- Include `aria-label` for icon-only buttons
- Use `aria-live` for dynamic content updates

### Motion

- Respect `prefers-reduced-motion`
- Provide static alternatives for animations
- Keep animations under 500ms for transitions

```tsx
// Respect user motion preferences
const motionConfig = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: {
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.3
  }
}
```

---

## Data Visualization Guidelines

### Chart Colors

```css
/* Sequential (Single Metric) */
--chart-primary: #F59E0B;
--chart-primary-light: #FCD34D;
--chart-primary-dark: #B45309;

/* Categorical (Multiple Series) */
--chart-series-1: #F59E0B;  /* Gold */
--chart-series-2: #8B5CF6;  /* Purple */
--chart-series-3: #06B6D4;  /* Cyan */
--chart-series-4: #22C55E;  /* Green */
--chart-series-5: #EC4899;  /* Pink */

/* Status in Charts */
--chart-positive: #22C55E;
--chart-negative: #EF4444;
--chart-neutral: #6B7280;
```

### D3.js Styling Conventions

```tsx
// Line Chart Styling
const lineStyles = {
  stroke: '#F59E0B',
  strokeWidth: 2,
  fill: 'none'
}

// Area Chart Gradient
const areaGradient = {
  id: 'gold-gradient',
  stops: [
    { offset: '0%', color: '#F59E0B', opacity: 0.3 },
    { offset: '100%', color: '#F59E0B', opacity: 0 }
  ]
}

// Axis Styling
const axisStyles = {
  tickColor: '#4B5563',
  labelColor: '#6B7280',
  fontSize: '12px'
}

// Tooltip
const tooltipStyles = {
  background: '#1A1A1A',
  border: '1px solid #374151',
  borderRadius: '8px',
  padding: '12px',
  color: '#FFFFFF'
}
```

---

## Fintech-Specific Patterns

### Trust Indicators

```html
<!-- Security Badge -->
<div class="flex items-center gap-2 text-green-400 text-sm">
  <svg class="w-4 h-4"><!-- Shield Icon --></svg>
  <span>Secured by Solana</span>
</div>

<!-- Verification Badge -->
<div class="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1">
  <svg class="w-4 h-4 text-amber-500"><!-- Check Icon --></svg>
  <span class="text-amber-400 text-xs font-medium">Verified</span>
</div>

<!-- Audit Trail Link -->
<a href="#" class="flex items-center gap-2 text-gray-400 hover:text-amber-400 text-sm transition-colors">
  <svg class="w-4 h-4"><!-- External Link --></svg>
  <span>View on Explorer</span>
</a>
```

### Real-Time Data Indicators

```html
<!-- Live Indicator -->
<div class="flex items-center gap-2">
  <span class="relative flex h-2 w-2">
    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
    <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
  </span>
  <span class="text-green-400 text-xs font-medium">Live</span>
</div>

<!-- Last Updated -->
<span class="text-gray-500 text-xs">Updated 30s ago</span>

<!-- Loading State -->
<div class="flex items-center gap-2 text-gray-400">
  <svg class="w-4 h-4 animate-spin"><!-- Spinner --></svg>
  <span class="text-sm">Syncing...</span>
</div>
```

### Transaction States

```html
<!-- Pending -->
<div class="flex items-center gap-2">
  <div class="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
    <svg class="w-4 h-4 text-yellow-400 animate-spin"><!-- Clock --></svg>
  </div>
  <div>
    <div class="text-white font-medium">Processing</div>
    <div class="text-gray-500 text-sm">Confirming on-chain...</div>
  </div>
</div>

<!-- Success -->
<div class="flex items-center gap-2">
  <div class="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
    <svg class="w-4 h-4 text-green-400"><!-- Check --></svg>
  </div>
  <div>
    <div class="text-white font-medium">Confirmed</div>
    <div class="text-gray-500 text-sm">Transaction complete</div>
  </div>
</div>

<!-- Failed -->
<div class="flex items-center gap-2">
  <div class="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
    <svg class="w-4 h-4 text-red-400"><!-- X --></svg>
  </div>
  <div>
    <div class="text-white font-medium">Failed</div>
    <div class="text-red-400 text-sm">Insufficient balance</div>
  </div>
</div>
```

---

## Usage Examples

When asked to create a component, I will:

1. Follow the design tokens defined above
2. Use the appropriate Tailwind classes
3. Include Framer Motion animations where appropriate
4. Ensure WCAG AA accessibility compliance
5. Consider mobile-first responsive design

Example request: "Create a wallet balance card"

```tsx
import { motion } from 'framer-motion';

export function WalletBalanceCard({ balance, change }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-gradient-to-br from-amber-900/20 to-gray-900 border border-amber-500/30 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Total Balance
        </span>
        <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs font-medium">
          +{change}%
        </span>
      </div>

      <div className="text-4xl font-bold text-white mb-2">
        ${balance.toLocaleString()}
      </div>

      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <svg className="w-4 h-4 text-amber-500">
          <circle cx="8" cy="8" r="6" fill="currentColor"/>
        </svg>
        <span>W3B Token</span>
      </div>
    </motion.div>
  );
}
```
