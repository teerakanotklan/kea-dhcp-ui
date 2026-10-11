---
name: ui-ux-pro-max
description: >-
  UI/UX design intelligence for web, mobile, and desktop. Use this skill when
  designing, building, reviewing, or fixing interfaces, including pages,
  components, design systems, accessibility, interaction, responsive layout,
  typography, color, charts, and stack-specific UI implementation.
---

# UI/UX Pro Max - Design Intelligence

Comprehensive UI/UX design intelligence tailored for Gemini and the Antigravity system: covers design systems, accessibility (WCAG AA/AAA), touch & interaction, performance, typography, color harmony, animations (GSAP/CSS), responsive layouts, and stack-specific implementations.

## When to Apply

Use this skill when the task involves **UI structure, visual design decisions, interaction patterns, or user experience quality control**:
- Designing new pages, dashboards, or landing pages
- Creating or refactoring UI components
- Choosing color palettes, typography scales, spacing tokens, or design systems
- Auditing UI for accessibility (a11y), contrast, and responsive behavior
- Implementing navigation, micro-interactions, transitions, or state feedback
- Improving perceived quality, aesthetic appeal, and usability

Skip it for pure backend logic, database design, API controllers, non-visual performance tuning, or DevOps/CI scripts — unless the task alters how something **looks, feels, animates, or is interacted with**.

---

## Rule Categories by Priority

Follow priority 1→10 to decide which category to focus on first:

| Priority | Category | Impact | Domain | Key Checks (Must Have) | Anti-Patterns (Avoid) |
|:---:|---|:---:|:---:|---|---|
| **1** | Accessibility | CRITICAL | `ux` | Contrast ratio ≥ 4.5:1 (normal) / 3:1 (large text), Alt text on imagery, Full keyboard navigation, `aria-label` / `aria-expanded` attributes | Removing focus rings (`outline: none` without replacement), Icon-only buttons without accessible labels |
| **2** | Touch & Interaction | CRITICAL | `ux` | Min touch target 44×44px, ≥ 8px target spacing, Visual feedback on press/hover, Clear loading & disabled states | Hover-only triggers on mobile, Instant state flips (0ms) without visual cue |
| **3** | Performance & CLS | HIGH | `ux` | Modern formats (WebP/AVIF/SVG), Lazy loading off-screen media, Explicit aspect ratios (CLS < 0.1) | Layout thrashing, Unbounded image rendering causing cumulative shifts |
| **4** | Style Selection | HIGH | `style`, `product` | Coherent design language matching product archetype, High-fidelity SVG icons (Lucide / Heroicons / Tabler) | Randomly mixing flat & skeuomorphic, Relying on emoji as interface icons |
| **5** | Layout & Responsive | HIGH | `ux` | Mobile-first breakpoints, Fluid grids/flexbox, Viewport meta tags, Zero horizontal overflow scroll | Fixed-pixel container widths (`width: 1200px`), Viewport zoom disabling |
| **6** | Typography & Color | MEDIUM | `typography`, `color` | Base font ≥ 16px, Line-height 1.5, Harmonious font pairings, Semantic color tokens (HSL / CSS variables) | Body text < 12px, Low contrast gray-on-gray, Hardcoded raw hex colors in components |
| **7** | Animation & Motion | MEDIUM | `ux`, `gsap` | Context-aware timing (150–300ms micro, 300–500ms transitions), Meaningful spatial continuity, `prefers-reduced-motion` | Same duration for all animations, Animating layout properties (`width`/`height`), Jarring jumps |
| **8** | Forms & Feedback | MEDIUM | `ux` | Persistent field labels, Inline validation errors near input, Helper hints, Progressive disclosure for complex flows | Placeholder as the sole label, Showing errors only in top banners, Wall of 20+ fields at once |
| **9** | Navigation Patterns | HIGH | `ux` | Predictable back behavior, Bottom navigation ≤ 5 items, Clear active state indicators, Deep linking | Overloaded navigation, Non-functional back buttons, Hidden drawer-only primary actions |
| **10** | Charts & Data | LOW | `chart` | Data legends, Interactive tooltips, Distinct patterns/textures alongside color | Relying on color alone to differentiate metrics |

---

## Operating Modes in Gemini / Antigravity

This skill operates in two complementary modes:

### Mode A: Script-Assisted Querying (If Local Scripts/Datasets Present)
When the local Python search tool and datasets are present in `.agents/skills/ui-ux-pro-max/scripts/`:

```powershell
# Run via Antigravity run_command
python .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>
```

*(If on Linux/macOS or global installation: `python ~/.gemini/config/skills/ui-ux-pro-max/scripts/search.py`)*

### Mode B: Direct Autonomous Reasoning (Always Available)
When running standalone without local Python datasets, Gemini uses its internalized design intelligence directly:
1. Apply the **Priority Matrix (1→10)** to guide design constraints.
2. Select an appropriate **Aesthetic Archetype** (e.g. Modern Minimalist, Glassmorphism, Clean SaaS, Bento Grid, Dark Ops).
3. Establish **CSS Tokens & Design Variables** (HSL colors, typography scales, spacing scale).
4. Adhere strictly to **Antigravity Visual Excellence** guidelines (see below).

---

## Workflow

### Step 1: Analyze Requirements & Tech Stack
Extract the following from the user request and repository context:
- **Product Archetype**: Enterprise SaaS, Developer Tool, E-commerce, Dashboard/Ops, Mobile App, Portfolio, or Consumer Service.
- **Target Audience & Context**: Work/high-density, leisure/consumer, dark-mode focused, mobile/touch-first.
- **Visual Tone**: Vibrant & futuristic, calm & corporate, high-density & technical, sleek & minimal.
- **Technology Stack**: Detect from workspace (`package.json`, `tailwind.config`, `pubspec.yaml`, etc.):
  - Web: React, Next.js, Vue, Svelte, Tailwind CSS, Vanilla CSS
  - Mobile: React Native, Flutter, SwiftUI, Jetpack Compose
  - Desktop: Electron, Tauri, WinUI, WPF

### Step 2: Establish Design System Tokens

For new pages or components, establish a systematic token foundation:

```css
:root {
  /* Surface & Background */
  --bg-primary: hsl(222, 47%, 11%);
  --bg-secondary: hsl(217, 33%, 17%);
  --bg-card: hsl(217, 33%, 20%);
  --border-subtle: hsl(217, 24%, 27%);
  
  /* Brand & Accent */
  --primary: hsl(210, 100%, 56%);
  --primary-hover: hsl(210, 100%, 64%);
  --accent: hsl(160, 84%, 39%);
  
  /* Text & Foreground */
  --text-primary: hsl(210, 40%, 98%);
  --text-secondary: hsl(215, 20%, 65%);
  --text-muted: hsl(215, 16%, 47%);
  
  /* Typography Scale */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  /* Spacing Scale (8pt Grid) */
  --space-1: 0.25rem; /* 4px */
  --space-2: 0.5rem;  /* 8px */
  --space-3: 0.75rem; /* 12px */
  --space-4: 1rem;    /* 16px */
  --space-6: 1.5rem;  /* 24px */
  --space-8: 2rem;    /* 32px */
  
  /* Radii & Shadows */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --shadow-card: 0 4px 20px -2px rgba(0, 0, 0, 0.25);
}
```

### Step 3: Design Dials

Tune the visual output across three primary spectrums:

| Dial | Low (1-3) | Mid (4-7) | High (8-10) |
|---|---|---|---|
| **Variance / Layout** | Strict centered grid, minimal hierarchy, high predictability | Balanced modern layouts, staggered cards, subtle asymmetry | Bento grids, dramatic scale contrast, dynamic editorial framing |
| **Motion & Micro-interactions** | Instant or subtle opacity transitions (150ms), no layout shifts | Smooth staggered reveals, hover elevations, spring tooltips | Choreographed GSAP/Framer animations, interactive canvas elements |
| **Density & Spacing** | Generous whitespace (24–64px spacing), marketing/consumer | Standard comfortable UI (16–32px spacing) | Dense technical dashboard (8–16px spacing, compact data tables) |

### Step 4: Component Construction Guidelines

When crafting or modifying UI components:
1. **Interactive States**: Every clickable element MUST have defined `:hover`, `:active`, `:focus-visible`, and `disabled` states.
2. **Accessible Contrast**: Always check text against its immediate background. When building dark mode cards, elevate surfaces (`--bg-card` lighter than `--bg-primary`) to maintain depth.
3. **Typography Hierarchy**: Use size, weight, and subtle color variance to guide scanning:
   - Page Title: 24–32px, bold/semibold, high contrast
   - Section Subheader: 14–16px, medium weight, secondary contrast
   - Body Copy: 14–16px, regular, 1.5–1.6 line height
   - Metadata / Badges: 11–13px, uppercase or medium weight, muted
4. **Icons**: Use SVG icon components (Lucide, Heroicons, etc.) with explicit `width`, `height`, and `aria-hidden="true"` (or an accessible label if standalone). Never use emojis as functional icons.
5. **Form Controls**:
   - Always connect `<label for="id">` to `<input id="id">`.
   - Provide immediate feedback upon blur or submit with clear, color-coded status badges and descriptive error text.

---

## Antigravity Aesthetics & Quality Checklist

Before finalizing any UI implementation in Antigravity:

- [ ] **Visual Impact**: Does the UI feel polished, modern, and intentional rather than like an unstyled default template?
- [ ] **Curated Color Palette**: Are colors defined via cohesive tokens rather than harsh generic primaries (`#ff0000`, `#0000ff`)?
- [ ] **Typography Excellence**: Are clean, modern fonts used with appropriate line-height and letter-spacing?
- [ ] **Dark Mode & Glassmorphism**: If dark-themed, do translucent layers have backdrop filters (`backdrop-blur`) and refined borders (`rgba(255, 255, 255, 0.08)`)?
- [ ] **Micro-animations**: Are interactive hover states, card lifts, and modal entrances smooth and context-aware?
- [ ] **Accessibility (WCAG 2.1 AA)**: Are contrast ratios compliant, focus indicators visible on keyboard tab, and interactive elements at least 44×44px touch-target area?
- [ ] **Responsive Integrity**: Does the layout gracefully adapt from mobile (375px) through desktop (1440px+) without unexpected horizontal scrollbars?
