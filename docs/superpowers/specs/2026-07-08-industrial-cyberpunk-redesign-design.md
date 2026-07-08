# Industrial Cyberpunk Redesign — Design Spec

## Overview

Complete UI/UX overhaul of LEIZ STORE (Next.js 16 e-commerce) from "Dark Gaming Premium" (cyan/violet/gold Genshin-style) to "Industrial Cyberpunk" (amber/gold + deep teal + off-black concrete). Replaces Framer Motion with GSAP + anime.js + mo.js. Adds CSS 3D transforms (perspective/rotate/translateZ). Target: 100 Lighthouse scores across all pages.

## Stack

- Next.js 16 (App Router) + React 19
- Tailwind CSS v4
- GSAP (ScrollTrigger) — scroll storytelling, pin, stagger
- anime.js — micro-interactions, hover 3D tilt, counters, input feedback
- mo.js — particle ambient, burst effects (lazy loaded)
- TypeScript strict mode

## Design System

### Color Palette — Industrial Cyberpunk

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#0A0A0C` | Pitch concrete — main background |
| `--surface` | `#121214` | Elevated panel |
| `--surface-elevated` | `#1A1A1E` | Card / elevated container |
| `--primary` | `#E8B84B` | Warm amber/gold — primary CTA, accents |
| `--secondary` | `#0D7377` | Deep teal — secondary accent |
| `--tertiary` | `#C0A060` | Muted gold — subtle accents |
| `--text` | `#F5F5F0` | Warm white — primary text |
| `--text-muted` | `#888883` | Readable secondary text |
| `--text-dim` | `#555555` | Placeholder / disabled |
| `--border` | `rgba(232, 184, 75, 0.10)` | Subtle borders |
| `--border-strong` | `rgba(232, 184, 75, 0.18)` | Stronger borders |
| `--error` | `#C23B3B` | Muted red |
| `--success` | `#7BA88B` | Muted sage green |

### Banned Colors
No cyan, no purple/violet, no hot pink, no neon green, no gradient text, no gold glow effects.

### Typography

| Role | Font | Weight | Tracking | Size (desktop) |
|------|------|--------|----------|----------------|
| Display | Geist Sans | 600 | -0.03em | clamp(36px, 5vw, 56px) |
| Heading 2 | Geist Sans | 600 | -0.02em | clamp(24px, 3vw, 36px) |
| Heading 3 | Geist Sans | 500 | -0.01em | clamp(20px, 2vw, 28px) |
| Body | Geist Sans | 400 | normal | 16px |
| Small | Geist Sans | 400 | normal | 14px |
| Mono | Geist Mono | 400 | normal | 14px (data, price) |
| Caption | Geist Sans | 400 | 0.02em | 12px |

- Line height: body 1.7, headings 1.2
- No gradient text anywhere

### Shape System

| Element | Radius |
|---------|--------|
| Buttons | 4px |
| Cards | 8px |
| Inputs | 4px |
| Badges / Pills | 9999px |
| Modals | 8px |
| Containers / Sections | 0 |

### Shadow System

| Layer | Shadow |
|-------|--------|
| Card default | `0 1px 3px rgba(0,0,0,0.4)` |
| Card hover | `0 4px 12px rgba(0,0,0,0.5)` |
| Modal | `0 8px 32px rgba(0,0,0,0.6)` |
| Button | none (flat) |
| Button hover | `0 2px 8px rgba(232,184,75,0.15)` |

### CSS 3D Transform System

- Perspective container: `perspective: 1200px` via CSS custom property
- Card 3D tilt: `transform-style: preserve-3d` + anime.js mouse tracking
- Depth layers: class `depth-1` (z: 20px), `depth-2` (z: 40px), `depth-3` (z: 60px)
- Parallax scroll: translateZ with different speeds per layer
- No Three.js — pure CSS 3D transforms only

## Animation Architecture

### Library Loading Strategy

| Library | Size | Load Strategy |
|---------|------|---------------|
| anime.js | ~15kb gzip | Global, loaded synchronously in layout |
| GSAP + ScrollTrigger | ~30kb gzip | Dynamic import via `next/dynamic` with `ssr: false` |
| mo.js | ~20kb gzip | Dynamic import per-page (homepage hero, checkout success) |

### GSAP Usage (Scroll Storytelling)

- `ScrollTrigger` only — no standalone GSAP animations without scroll trigger
- Every ScrollTrigger must have a clear narrative purpose
- Canonical patterns (from design-taste-frontend skill):
  - **Section entry:** `ScrollTrigger.create` with fade + translateY, scrub
  - **Hero sticky-stack:** pin cards as user scrolls
  - **Horizontal scroll:** pin section, scroll inner track horizontally
  - **Stagger reveal:** child elements fade up with delay cascade
- All GSAP wrapped in `useEffect` with cleanup via `ctx.revert()`
- `useReducedMotion` from motion/react disables all GSAP

### anime.js Usage (Micro-interactions)

- `useAnimeTilt(ref, options)` — hook for 3D card tilt on mouse move
- Button press: scale(0.97) on mousedown, restore on mouseup
- Counter animation: count-up numbers on scroll reveal
- Input glow: border color animation on focus
- All wrapped in `useEffect` with `anime.remove(ref)` cleanup

### mo.js Usage (Effects)

- Only two effects:
  1. **Hero ambient particles** — slow-moving gold particles in background
  2. **Checkout success burst** — celebration particle burst
- Both lazy-loaded via IntersectionObserver + dynamic import
- Minimal configuration, no heavy shapes

### Reduced Motion

- All animations gated by `prefers-reduced-motion` media query
- GSAP: ScrollTrigger auto-disables when reduced motion is active
- anime.js: skip all animation calls, set final state directly
- mo.js: skip entirely

## Component Architecture

### New Global Components

| Component | Description |
|-----------|-------------|
| `TiltCard` | Wrapper: CSS 3D perspective container + anime.js mouse tilt |
| `ScrollReveal` | GSAP ScrollTrigger fade-up wrapper (intersection-based) |
| `FloatLayer` | translateZ parallax depth layer (consumes `data-depth` prop) |
| `ParticleBg` | mo.js ambient particle background (lazy) |
| `Counter` | anime.js animated number counter |
| `Skeleton` | CSS-only skeleton shimmer (amber accent) |

### Navbar (New)

- Height: 72px (desktop), 64px (mobile)
- Background: solid #0A0A0C
- Border-bottom: 1px solid var(--border)
- Sticky top, backdrop-filter only when scrolled (via IntersectionObserver + CSS class toggle)
- Layout: [LEIZ logo] [Products / Track / Wishlist] [Cart + Sign In]
- Mobile: hamburger morph to X via GSAP timeline

### Buttons

| Variant | Style |
|---------|-------|
| Primary | bg #E8B84B, text #0A0A0C, flat, border-radius 4px, hover: lighten 10% |
| Secondary | border 1px var(--border-strong), text #F5F5F0, bg transparent, hover: bg rgba(232,184,75,0.06) |
| Ghost | no border, text var(--text-muted), hover: text var(--text) |
| Danger | bg #C23B3B, text white |

All buttons: active scale(0.97) via anime.js, white-space nowrap, no wrap at desktop.

### Inputs

- Height: 44px (touch target)
- Background: rgba(255,255,255,0.03)
- Border: 1px var(--border)
- Focus: border var(--primary), ring 2px rgba(232,184,75,0.12) via anime.js
- Placeholder: var(--text-dim)
- Label above input, error below input

## Page Breakdown

### Homepage (`/`)

| Section | Layout | Animation | Notes |
|---------|--------|-----------|-------|
| Hero | Full viewport, left-aligned text, right visual space | GSAP fade-up headline + subtext; mo.js ambient particles; CTA stagger | Headline: "Premium Items. Instant Delivery." Subtext max 20 words |
| Trust Bar | Horizontal logo strip | GSAP horizontal auto-scroll (marquee) | Payment methods, brand logos |
| Featured Categories | 3 bento cards, CSS grid asimetris | TiltCard on each; GSAP stagger reveal on scroll | Masing-masing: gambar + label + CTA |
| How It Works | 3 vertical steps with divider | GSAP ScrollTrigger reveal per step; FloatLayer background depth | |
| Testimonials | Horizontal scroll snap cards | GSAP horizontal scroll hijack | Max 3 lines per quote |
| CTA Banner | Full-width amber gradient subtle | GSAP parallax float layer | Headline + 1 CTA |

### Products (`/products`)

- Filter sidebar (left, sticky) + product grid (right)
- ProductCard: TiltCard wrapper, image, title, price (amber), add-to-cart button
- Grid: responsive 4-3-2-1 columns
- Filter: accordion collapse via anime.js
- Search: input with anime.js focus glow
- Entry: GSAP stagger reveal on load / pagination
- Infinite scroll with load-more button

### Product Detail (`/products/[slug]`)

- Split: left image (50%), right info (50%)
- Image: TiltCard, gallery thumbnails with GSAP crossfade
- Info: title, rating, price (Counter animation), description, stock indicator
- Quantity: anime.js bounce counter
- Add to cart: primary button, 3D press feedback
- Related products: horizontal scroll GSAP carousel

### Checkout (`/checkout`)

- Step indicator top: GSAP timeline progress
- Multi-step form with GSAP slide transition
- Order summary sidebar (sticky right)
- Payment method selection cards
- Submit: skeleton loading state
- Confirmation screen: mo.js celebration burst

### Payment (`/payment/[orderId]`)

- Upload proof area: anime.js pulse drag-drop zone
- Confirm button with loading state
- Payment info card (Bank Jago, GoPay/DANA)

### Track (`/track`)

- Order number input + Track button
- Timeline status visualization: GSAP reveal per step
- Order details card

### Wishlist, Privacy, Terms

- Standard page layout mengikuti design system
- Minimal animation: only entry fade
- Clean typography hierarchy

### Admin Pages

- Sidebar: amber active indicator (bukan purple)
- Tables: sortable, GSAP row entry stagger
- Forms: standard input system
- Cards, stats, charts mengikuti color system
- Animasi minimal (hover, skeleton loading, entry fade)

## Performance Strategy (100 Lighthouse)

### Bundle Optimization

1. **Uninstall framer-motion** — save ~30kb gzipped
2. **anime.js** — loaded globally via simple import (15kb, acceptable)
3. **GSAP** — dynamic import via `next/dynamic`:
   ```ts
   const gsapPromise = import("gsap").then(m => {
     import("gsap/ScrollTrigger").then(() => m.gsap.registerPlugin(ScrollTrigger));
     return m.gsap;
   });
   ```
4. **mo.js** — dynamic import only on pages that need it
5. Lucide icons tetap dipake (tree-shakeable via `optimizeImports`)

### Rendering

- All pages remain `"use client"` where interactivity is needed
- Static pages (privacy, terms) stay server components
- GSAP/anime.js code isolated in leaf components, never in layout
- No SSR for animation-heavy components

### Core Web Vitals

| Metric | Target | Strategy |
|--------|--------|----------|
| LCP | < 2.5s | priority hero image, preload critical assets, no render-blocking JS |
| INP | < 200ms | anime.js for micro-anims (16ms per frame), no RAF in React state |
| CLS | < 0.1 | Reserve space for all images, aspect-ratio, font-display swap |

### CSS

- No runtime CSS-in-JS
- All animations via `transform` and `opacity` — GPU composited
- `backdrop-filter` only on sticky navbar (scrolled state)
- Grain/noise overlay on fixed pseudo-element (already done correctly)

### Loading

- GSAP: deferred until after LCP
- mo.js: loaded on interaction or viewport entry
- Images: next/image with lazy loading, priority for hero
- Service worker: tetap (PWA)
- Fonts: Geist already preloaded, display:swap

## Implementation Order

1. Setup (install GSAP, anime.js, mo.js; uninstall framer-motion)
2. Global design system (CSS variables, tailwind theme, globals.css update)
3. Global components (Navbar, Footer, layout, CartDrawer)
4. Animation utilities (hooks: useAnimeTilt, useGsapScroll; components: TiltCard, ScrollReveal, FloatLayer, ParticleBg, Counter)
5. Homepage (hero -> trust -> categories -> testimonials -> CTA)
6. Products page + ProductCard
7. Product Detail page
8. Checkout page
9. Payment page
10. Track page
11. Wishlist, Privacy, Terms
12. Admin pages
13. Performance audit + Lighthouse verification
