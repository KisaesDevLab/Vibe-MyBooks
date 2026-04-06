# KIS Books — Display Preferences & Responsive Design Feature Plan

**Feature:** User-controlled font size scaling, dark mode toggle, and responsive mobile layout
**Date:** April 2, 2026
**Depends on:** BUILD_PLAN.md Phase 1 (auth, app shell, sidebar)
**Integrates with:** Every page and component in the application

---

## Feature Overview

Three interconnected display capabilities:

1. **Font size scaling** — increase or decrease the base font size across the entire application (not a zoom — a typographic scale that adjusts text, spacing, and component sizing proportionally)
2. **Dark mode toggle** — switch between light, dark, and system-follows-OS themes
3. **Responsive mobile layout** — the application adapts gracefully from desktop (1440px+) down to phone screens (320px), with touch-optimized interactions and layout transformations per breakpoint

Font size and theme preferences persist per user (stored server-side on the user record) and apply instantly without a page reload. They are not company-level settings — each user on a shared installation (Phase 2 accountant access) sees their own preference.

Responsive layout is automatic — no user preference needed. The app detects viewport width and adapts.

### Mobile Scope

The full application is mobile-friendly **except Batch Entry**, which is a desktop-only power tool. On mobile viewports, the Batch Entry sidebar link shows a message directing the user to a desktop browser. All other screens — dashboard, transactions, invoices, contacts, banking, reports, register, settings, setup wizard — are fully usable on a phone.

### Where the controls live

The sidebar footer — always visible, always one click away. No digging into settings.

```
┌──────────────────────┐
│  ☰  KIS Books        │
│                      │
│  Dashboard           │
│  Transactions        │
│  Invoices            │
│  Banking             │
│  Reports             │
│  Contacts            │
│  Chart of Accounts   │
│                      │
│  Settings            │
│                      │
│ ─────────────────── │
│  [A-] [A] [A+]  ◐   │  ← font size controls + dark mode toggle
│  kurt@kisaes.com     │
│  Logout              │
└──────────────────────┘
```

---

## 1. Design System: Font Size Scaling

### 1.1 Scale Levels

Five levels, anchored around a default of 16px:

| Level | Label | Base Size | CSS Variable Value | Scale Factor |
|---|---|---|---|---|
| 1 | XS | 13px | `0.8125rem` | 0.8125 |
| 2 | S | 14px | `0.875rem` | 0.875 |
| 3 | **M (default)** | **16px** | **`1rem`** | **1.0** |
| 4 | L | 18px | `1.125rem` | 1.125 |
| 5 | XL | 20px | `1.25rem` | 1.25 |

### 1.2 How Scaling Works

The entire application's typography is built on `rem` units relative to a CSS custom property on the `<html>` element. Changing one variable rescales everything.

```css
:root {
  --font-scale: 1;              /* default, overridden per user preference */
  font-size: calc(16px * var(--font-scale));
}
```

When the user selects level 4 (L), the app sets `--font-scale: 1.125`, which makes `1rem = 18px` everywhere. All text, spacing defined in `rem`, input heights, button padding — everything scales proportionally.

**What scales (rem-based):**
- Body text, headings, labels
- Input and button heights and padding
- Table cell padding
- Modal widths and padding
- Card padding
- Sidebar width
- Spacing between sections

**What does NOT scale (px-based, intentionally fixed):**
- Icons (stay 16px / 20px / 24px)
- Borders (stay 0.5px / 1px)
- Border radius (stays fixed)
- Minimum touch targets (stay 44px on mobile)
- Logo/image dimensions
- Chart and graph dimensions (responsive to container, not font scale)

### 1.3 Component Impact

Every component in the design system must use `rem` for text and spacing. Audit and convert any `px` values for text/padding:

| Component | Properties to Convert |
|---|---|
| Body text | `font-size`, `line-height` |
| Headings (h1–h3) | `font-size`, `line-height`, `margin` |
| Button | `font-size`, `padding`, `min-height` |
| Input / Select / Textarea | `font-size`, `padding`, `min-height` |
| Table cells | `font-size`, `padding` |
| Modal | `padding`, `max-width` (capped) |
| Card | `padding` |
| Sidebar | `width`, `font-size`, `padding`, `icon gap` |
| Sidebar nav items | `padding`, `font-size` |
| Toast notifications | `font-size`, `padding` |
| Dropdown menus | `font-size`, `padding`, `max-height` |
| Badge / Tag pills | `font-size`, `padding` |
| Tooltip | `font-size`, `padding` |
| Form labels | `font-size`, `margin-bottom` |
| Empty state text | `font-size` |

---

## 2. Design System: Dark Mode

### 2.1 Theme Modes

Three options:

| Mode | Behavior |
|---|---|
| **Light** | Light backgrounds, dark text. Always. |
| **Dark** | Dark backgrounds, light text. Always. |
| **System** (default) | Follows the user's OS preference via `prefers-color-scheme` media query. |

### 2.2 CSS Variable Architecture

All colors throughout the app are defined as CSS custom properties. Light and dark themes swap the values of these properties.

```css
/* Light theme (default) */
:root,
[data-theme="light"] {
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F8F8F6;
  --color-bg-tertiary: #F0EFEB;
  --color-bg-inverse: #1A1A1A;

  --color-text-primary: #1A1A1A;
  --color-text-secondary: #6B6B6B;
  --color-text-tertiary: #9B9B9B;
  --color-text-inverse: #FFFFFF;

  --color-border-primary: rgba(0, 0, 0, 0.40);
  --color-border-secondary: rgba(0, 0, 0, 0.20);
  --color-border-tertiary: rgba(0, 0, 0, 0.10);

  /* Semantic */
  --color-bg-success: #EAF3DE;
  --color-bg-warning: #FAEEDA;
  --color-bg-danger: #FCEBEB;
  --color-bg-info: #E6F1FB;

  --color-text-success: #3B6D11;
  --color-text-warning: #854F0B;
  --color-text-danger: #A32D2D;
  --color-text-info: #185FA5;

  --color-border-success: #97C459;
  --color-border-warning: #EF9F27;
  --color-border-danger: #F09595;
  --color-border-info: #85B7EB;

  /* Surfaces */
  --color-sidebar-bg: #F8F8F6;
  --color-sidebar-text: #1A1A1A;
  --color-sidebar-active-bg: #EEEDFE;
  --color-sidebar-active-text: #534AB7;
  --color-sidebar-hover-bg: rgba(0, 0, 0, 0.04);

  /* Inputs */
  --color-input-bg: #FFFFFF;
  --color-input-border: rgba(0, 0, 0, 0.20);
  --color-input-focus-border: #534AB7;
  --color-input-placeholder: #9B9B9B;

  /* Table */
  --color-table-header-bg: #F8F8F6;
  --color-table-row-hover: rgba(0, 0, 0, 0.02);
  --color-table-row-alt: rgba(0, 0, 0, 0.015);
  --color-table-border: rgba(0, 0, 0, 0.08);

  /* Charts */
  --color-chart-1: #534AB7;
  --color-chart-2: #1D9E75;
  --color-chart-3: #D85A30;
  --color-chart-4: #185FA5;
  --color-chart-5: #D4537E;
  --color-chart-6: #639922;

  /* Misc */
  --color-focus-ring: rgba(83, 74, 183, 0.4);
  --color-backdrop: rgba(0, 0, 0, 0.5);
  --color-scrollbar-thumb: rgba(0, 0, 0, 0.15);
  --color-scrollbar-track: transparent;
}

/* Dark theme */
[data-theme="dark"] {
  --color-bg-primary: #1A1A1E;
  --color-bg-secondary: #242428;
  --color-bg-tertiary: #2C2C32;
  --color-bg-inverse: #FFFFFF;

  --color-text-primary: #E8E8E8;
  --color-text-secondary: #A0A0A0;
  --color-text-tertiary: #707070;
  --color-text-inverse: #1A1A1A;

  --color-border-primary: rgba(255, 255, 255, 0.35);
  --color-border-secondary: rgba(255, 255, 255, 0.18);
  --color-border-tertiary: rgba(255, 255, 255, 0.08);

  /* Semantic — darker versions */
  --color-bg-success: #1A2E10;
  --color-bg-warning: #2E2008;
  --color-bg-danger: #2E1010;
  --color-bg-info: #0E1E30;

  --color-text-success: #97C459;
  --color-text-warning: #EF9F27;
  --color-text-danger: #F09595;
  --color-text-info: #85B7EB;

  --color-border-success: #3B6D11;
  --color-border-warning: #854F0B;
  --color-border-danger: #A32D2D;
  --color-border-info: #185FA5;

  /* Surfaces */
  --color-sidebar-bg: #18181C;
  --color-sidebar-text: #E8E8E8;
  --color-sidebar-active-bg: #2A2640;
  --color-sidebar-active-text: #AFA9EC;
  --color-sidebar-hover-bg: rgba(255, 255, 255, 0.04);

  /* Inputs */
  --color-input-bg: #242428;
  --color-input-border: rgba(255, 255, 255, 0.15);
  --color-input-focus-border: #AFA9EC;
  --color-input-placeholder: #606060;

  /* Table */
  --color-table-header-bg: #242428;
  --color-table-row-hover: rgba(255, 255, 255, 0.03);
  --color-table-row-alt: rgba(255, 255, 255, 0.02);
  --color-table-border: rgba(255, 255, 255, 0.06);

  /* Charts — brighter for dark bg */
  --color-chart-1: #AFA9EC;
  --color-chart-2: #5DCAA5;
  --color-chart-3: #F0997B;
  --color-chart-4: #85B7EB;
  --color-chart-5: #ED93B1;
  --color-chart-6: #97C459;

  /* Misc */
  --color-focus-ring: rgba(175, 169, 236, 0.4);
  --color-backdrop: rgba(0, 0, 0, 0.7);
  --color-scrollbar-thumb: rgba(255, 255, 255, 0.15);
  --color-scrollbar-track: transparent;
}

/* System preference */
[data-theme="system"] {
  /* Inherits from :root (light) by default */
}

@media (prefers-color-scheme: dark) {
  [data-theme="system"] {
    /* Same values as [data-theme="dark"] */
    --color-bg-primary: #1A1A1E;
    /* ... (all dark values) ... */
  }
}
```

### 2.3 Component-Specific Dark Mode Considerations

| Area | Light | Dark | Notes |
|---|---|---|---|
| Invoice PDF | Always light | Always light | PDFs don't follow theme — they're printed documents |
| Receipt OCR preview | Follow theme | Follow theme | Image stays original; surrounding UI follows theme |
| Charts (recharts) | Use `--color-chart-N` | Use `--color-chart-N` | Chart colors auto-adapt via CSS vars |
| Code/mono text | Light bg highlight | Dark bg highlight | Monospace fields (ref numbers, amounts) |
| Logo | User-uploaded | User-uploaded | May not look good on dark bg — show on a white pill if needed |
| Favicon | Static | Static | Single favicon, designed to work on both |
| Email templates | Always light | Always light | Emails render in the recipient's mail client |
| Print output | Always light | Always light | `@media print` forces light theme |

---

## 3. Data Model

### 3.1 User Preferences Column

Add to the existing `users` table (no new table needed):

```sql
ALTER TABLE users ADD COLUMN display_preferences JSONB DEFAULT '{
  "font_scale": 1,
  "theme": "system"
}'::jsonb;
```

**Structure:**

```json
{
  "font_scale": 1.0,
  "theme": "system"
}
```

- `font_scale`: one of `0.8125`, `0.875`, `1`, `1.125`, `1.25`
- `theme`: one of `"light"`, `"dark"`, `"system"`

Using JSONB makes it easy to add future preferences (compact mode, sidebar collapsed, etc.) without migrations.

### 3.2 No Separate API Call Needed

Display preferences are returned as part of the existing `GET /auth/me` response and updated via a lightweight endpoint. They are also embedded in the JWT payload refresh cycle so the frontend can apply them before the first API call completes (from localStorage cache).

---

## 4. API

### 4.1 Endpoints

```
GET  /api/v1/auth/me                    # Already exists — response now includes display_preferences
PUT  /api/v1/users/me/preferences       # Update display preferences (partial merge)
```

**PUT request body (partial — only include fields being changed):**

```json
{
  "font_scale": 1.125
}
```

or

```json
{
  "theme": "dark"
}
```

**Response:**

```json
{
  "display_preferences": {
    "font_scale": 1.125,
    "theme": "dark"
  }
}
```

### 4.2 Validation

- `font_scale` must be one of: `0.8125`, `0.875`, `1`, `1.125`, `1.25`
- `theme` must be one of: `"light"`, `"dark"`, `"system"`
- Invalid values return 400

---

## 5. Frontend Architecture

### 5.1 Theme Provider

```
packages/web/src/providers/ThemeProvider.tsx
```

A React context provider that wraps the entire application and manages both theme and font scale.

- [ ] **On mount:**
  1. Read cached preferences from `localStorage` (instant, no flash)
  2. Apply `data-theme` attribute to `<html>` element
  3. Apply `--font-scale` CSS variable to `<html>` element
  4. Fetch `GET /auth/me` for server-side preferences
  5. If server preferences differ from cache, update cache and re-apply

- [ ] **On preference change:**
  1. Apply immediately to DOM (optimistic — no waiting for API)
  2. Update `localStorage` cache
  3. Fire `PUT /users/me/preferences` in the background
  4. If API fails, preferences are still applied locally (resilient)

- [ ] **System theme detection:**
  - Listen to `window.matchMedia('(prefers-color-scheme: dark)')` change events
  - When `theme === 'system'`, toggle dark/light in real-time as OS preference changes

- [ ] **Context value:**

```typescript
interface ThemeContext {
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';       // actual theme after resolving 'system'
  fontScale: number;
  fontScaleLevel: 1 | 2 | 3 | 4 | 5;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setFontScale: (level: 1 | 2 | 3 | 4 | 5) => void;
  increaseFontSize: () => void;           // go up one level (capped at 5)
  decreaseFontSize: () => void;           // go down one level (capped at 1)
}
```

### 5.2 Flash Prevention

The theme must be applied before React renders to prevent a light→dark flash.

- [ ] Inline `<script>` in `index.html` (before React loads) that reads `localStorage` and applies `data-theme` and `--font-scale` to `<html>`:

```html
<script>
  (function() {
    try {
      var prefs = JSON.parse(localStorage.getItem('kis-display-prefs'));
      if (prefs) {
        if (prefs.theme === 'dark' || (prefs.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.setAttribute('data-theme', prefs.theme || 'light');
        }
        if (prefs.font_scale) {
          document.documentElement.style.setProperty('--font-scale', prefs.font_scale);
        }
      }
    } catch(e) {}
  })();
</script>
```

### 5.3 CSS Transition

Theme changes should transition smoothly, not snap:

```css
html {
  transition: background-color 0.2s ease, color 0.2s ease;
}

/* Disable transition during initial load to prevent flash */
html.no-transition * {
  transition: none !important;
}
```

The ThemeProvider adds `no-transition` class on mount and removes it after the first paint.

---

## 6. Frontend Components

### 6.1 Sidebar Display Controls

```
packages/web/src/components/layout/SidebarDisplayControls.tsx
```

A compact control strip in the sidebar footer.

- [ ] **Font size controls:**
  - Three buttons in a row: `[A−]` `[A]` `[A+]`
  - `A−` decreases one level (disabled at level 1)
  - `A` resets to default (level 3, 16px) — only shown if not at default
  - `A+` increases one level (disabled at level 5)
  - Current level indicated by a subtle dot indicator below the buttons (5 dots, active one filled)
  - Tooltip on hover: "Decrease text size" / "Reset text size" / "Increase text size"

- [ ] **Dark mode toggle:**
  - Single icon button that cycles: Light → Dark → System → Light
  - Icon changes per state:
    - Light: sun icon
    - Dark: moon icon
    - System: monitor icon (half sun/half moon)
  - Tooltip: "Switch to dark mode" / "Switch to system theme" / "Switch to light mode"
  - Smooth icon transition on click

- [ ] **Layout:**

```
┌─────────────────────────┐
│  [A−] [A] [A+]     [◐]  │
│  · · ● · ·              │  ← dot indicator (level 3 active)
└─────────────────────────┘
```

Compact — fits in a single row at the bottom of the sidebar. Total height: ~48px.

### 6.2 Settings Page Section

```
packages/web/src/features/settings/DisplayPreferencesSection.tsx
```

A more detailed version of the same controls, available in the Settings page for users who want more context.

- [ ] **Font size:**
  - Labeled slider or segmented control: XS | S | M | L | XL
  - Live preview text below: "This is how your text will look at this size."
  - Current size shown in px: "Base size: 18px"

- [ ] **Theme:**
  - Three-option toggle: Light | Dark | System
  - Below the toggle: "System mode follows your device's appearance settings."
  - Preview card showing a mini version of the app in the selected theme

- [ ] Both controls save immediately on change (same as sidebar — no save button needed)

### 6.3 Updated UI Components Audit

Every shared UI component must exclusively use CSS variables for colors and `rem` for sizing.

- [ ] `Button.tsx` — use CSS vars for bg, text, border, hover states; `rem` for font-size and padding
- [ ] `Input.tsx` — CSS vars; `rem` for font-size, padding, height
- [ ] `Select.tsx` — CSS vars; `rem` sizing
- [ ] `Textarea.tsx` — CSS vars; `rem` sizing
- [ ] `Card.tsx` — CSS vars for bg, border; `rem` for padding
- [ ] `Modal.tsx` — CSS vars for bg, backdrop, border; `rem` for padding, max-width
- [ ] `Table.tsx` — CSS vars for header bg, row hover, border; `rem` for cell padding, font-size
- [ ] `Badge.tsx` — CSS vars; `rem` for font-size, padding
- [ ] `Toast.tsx` — CSS vars; `rem` for font-size, padding
- [ ] `Tooltip.tsx` — CSS vars; `rem` for font-size, padding
- [ ] `Dropdown.tsx` — CSS vars; `rem` for font-size, padding, max-height
- [ ] `LoadingSpinner.tsx` — CSS vars for color; fixed `px` for size (doesn't scale)
- [ ] `ErrorMessage.tsx` — CSS vars; `rem`
- [ ] `EmptyState.tsx` — CSS vars; `rem`
- [ ] `DatePicker.tsx` — CSS vars; `rem`
- [ ] `MoneyInput.tsx` — CSS vars; `rem`
- [ ] `AccountSelector.tsx` — CSS vars; `rem`
- [ ] `ContactSelector.tsx` — CSS vars; `rem`
- [ ] `TagSelector.tsx` — CSS vars; `rem`

### 6.4 Layout Components Audit

- [ ] `AppShell.tsx` — sidebar bg, main content bg use CSS vars; sidebar width in `rem`
- [ ] `Sidebar.tsx` — all colors via CSS vars; nav items padding/font in `rem`; display controls in footer
- [ ] `Header.tsx` — CSS vars; `rem` sizing
- [ ] `AuthLayout.tsx` — CSS vars for bg; `rem` for card sizing

---

## 7. Build Checklist

### 7.1 Design System & CSS
- [ ] Create `packages/web/src/styles/themes.css` — complete light and dark theme CSS variable definitions (from §2.2)
- [ ] Create `packages/web/src/styles/typography.css` — font scale system with `--font-scale` variable (from §1.2)
- [ ] Verify all 5 font scale levels render correctly without layout breaks
- [ ] Verify all colors have proper contrast ratios in both themes (WCAG AA minimum: 4.5:1 for body text, 3:1 for large text)
- [ ] Add print media query that forces light theme: `@media print { :root { /* light theme vars */ } }`
- [ ] Add `transition: background-color 0.2s ease, color 0.2s ease` for smooth theme switching
- [ ] Create `no-transition` utility class for initial load

### 7.2 API & Data
- [ ] Create migration: add `display_preferences JSONB` column to `users` table
- [ ] Create `packages/shared/src/types/preferences.ts` — `DisplayPreferences`, `FontScaleLevel`, `ThemeMode`
- [ ] Create `packages/shared/src/schemas/preferences.ts` — Zod schema validating font_scale and theme values
- [ ] Update `GET /auth/me` response to include `display_preferences`
- [ ] Create `PUT /api/v1/users/me/preferences` endpoint (partial JSONB merge)
- [ ] Write Vitest tests:
  - [ ] Preference update persists and returns correct values
  - [ ] Invalid font_scale (e.g., 2.0) returns 400
  - [ ] Invalid theme (e.g., "midnight") returns 400
  - [ ] Partial update merges correctly (update only theme, font_scale unchanged)

### 7.3 Frontend — Theme Provider
- [ ] Create `packages/web/src/providers/ThemeProvider.tsx` with context, localStorage caching, OS media query listener
- [ ] Add inline `<script>` to `index.html` for flash prevention
- [ ] Create `packages/web/src/hooks/useTheme.ts` — hook that consumes ThemeProvider context
- [ ] Create `packages/web/src/api/hooks/usePreferences.ts`:
  - `useDisplayPreferences()` — read from auth/me cache
  - `useUpdatePreferences()` — mutation with optimistic local apply
- [ ] Wrap `<App>` in `<ThemeProvider>`
- [ ] Verify: changing theme applies immediately (no flash, no reload)
- [ ] Verify: changing font scale applies immediately
- [ ] Verify: preferences survive page refresh (localStorage)
- [ ] Verify: preferences sync from server on login (overrides stale localStorage)
- [ ] Verify: system theme follows OS toggle in real-time

### 7.4 Frontend — Sidebar Controls
- [ ] Create `SidebarDisplayControls.tsx` — font size buttons + theme toggle
- [ ] Integrate into `Sidebar.tsx` footer
- [ ] Font size: A− / A (reset) / A+ buttons with dot indicator
- [ ] Theme: cycling icon button (sun → moon → monitor)
- [ ] Tooltips on all buttons
- [ ] Disabled state on A− at level 1 and A+ at level 5
- [ ] Reset button (A) hidden when already at default

### 7.5 Frontend — Settings Page Section
- [ ] Create `DisplayPreferencesSection.tsx` for Settings page
- [ ] Font size: labeled segmented control (XS/S/M/L/XL) with live preview
- [ ] Theme: three-option toggle (Light/Dark/System) with description text
- [ ] Add to Settings page under an "Appearance" heading

### 7.6 Frontend — Component Audit (rem + CSS vars)
- [ ] Audit and update all UI primitive components (§6.3 list — 19 components)
- [ ] Audit and update all layout components (§6.4 list — 4 components)
- [ ] Audit and update feature-specific components:
  - [ ] Invoice form and PDF preview (PDF stays light)
  - [ ] Report pages and charts (recharts uses CSS vars for colors)
  - [ ] Account register (dense grid must remain readable at all scales)
  - [ ] Batch entry grid (virtual scroll grid must handle variable row heights)
  - [ ] Bank feed review page
  - [ ] Dashboard charts and cards
  - [ ] Setup wizard (must work before preferences exist — use system default)

### 7.7 Frontend — Edge Cases
- [ ] Company logo on dark background: if logo has a transparent bg and dark elements, show it on a white pill (`background: white; border-radius: 4px; padding: 4px`)
- [ ] Recharts/chart components: verify all chart colors are legible in both themes
- [ ] Invoice PDF: always renders in light theme regardless of user preference
- [ ] Print: `@media print` forces light theme
- [ ] Email templates: always light (they render in the recipient's mail client)
- [ ] Setup wizard: uses system default (user has no saved preferences yet)
- [ ] Login page: uses system default (no user context yet) — reads localStorage if available from a previous session
- [ ] Font scale at XL (20px): verify no horizontal overflow, truncation, or broken layouts on:
  - [ ] Sidebar navigation
  - [ ] Transaction list table
  - [ ] Invoice form
  - [ ] Report tables
  - [ ] Modals
  - [ ] Account register
  - [ ] Batch entry grid
- [ ] Font scale at XS (13px): verify text remains readable, touch targets stay ≥ 44px on mobile

### 7.8 Responsive & Mobile Layout
- [ ] Define breakpoint tokens in Tailwind config (see §9.1)
- [ ] Create `packages/web/src/hooks/useBreakpoint.ts` — returns current breakpoint and boolean helpers (`isMobile`, `isTablet`, `isDesktop`)
- [ ] Create `packages/web/src/hooks/useMobileDetect.ts` — detects touch device, sets viewport meta tag
- [ ] **App Shell — mobile layout:**
  - [ ] Sidebar collapses to an off-canvas drawer on mobile (hamburger icon in top bar)
  - [ ] Top navigation bar: hamburger menu (left), page title (center), user avatar + theme toggle (right)
  - [ ] Drawer opens from left with overlay backdrop, swipe-to-close gesture
  - [ ] Drawer closes on navigation (link click)
  - [ ] Display controls (font size + theme) move to the bottom of the drawer on mobile
  - [ ] Bottom navigation bar (mobile only): 5 primary icons — Dashboard, Transactions, Invoices, Banking, More
  - [ ] "More" tab opens a full-screen menu with remaining navigation items
- [ ] **Dashboard — mobile layout:**
  - [ ] Metric cards: 2-column grid on tablet, single-column stack on phone
  - [ ] Revenue vs Expense chart: full width, reduced height (200px on mobile vs 300px desktop)
  - [ ] Cash position and receivables cards: stack vertically
  - [ ] Action items: collapsible accordion on mobile
- [ ] **Transaction list — mobile layout:**
  - [ ] Table transforms to card list on mobile: each transaction is a card showing date, payee, amount, type badge
  - [ ] Swipe actions on cards: swipe right → edit, swipe left → void (with confirmation)
  - [ ] Filter toolbar collapses to a "Filter" button that opens a bottom sheet with all filter options
  - [ ] Sort options in a dropdown instead of clickable column headers
  - [ ] Floating action button (FAB) for "New Transaction" — opens a type picker bottom sheet
- [ ] **Transaction forms — mobile layout:**
  - [ ] Single-column layout (all fields stacked vertically)
  - [ ] Full-width inputs and selectors
  - [ ] Contact and account selectors open as full-screen searchable modals on mobile
  - [ ] Line items (invoices, cash sales): each line item is a card; "Add line" button below
  - [ ] Action buttons sticky at bottom of viewport
  - [ ] Journal entry form: debit/credit fields stack vertically per line; running totals sticky at bottom
- [ ] **Invoice list — mobile layout:**
  - [ ] Card-based list: each card shows invoice number, customer, amount, status badge, due date
  - [ ] Quick actions: tap card → detail view; long-press → action menu (send, record payment, void)
  - [ ] Filter as bottom sheet
- [ ] **Invoice detail — mobile layout:**
  - [ ] Invoice preview scrolls vertically (full-width rendering)
  - [ ] Action buttons in a sticky bottom bar: Send, Record Payment, Download PDF, More (…)
  - [ ] Payment history as a collapsible section below the invoice
- [ ] **Contacts list — mobile layout:**
  - [ ] Card list with avatar/initials, name, type badge, phone (tap to call), email (tap to compose)
  - [ ] Search bar pinned at top
  - [ ] FAB for "New Contact"
- [ ] **Contact detail — mobile layout:**
  - [ ] Full-width contact card
  - [ ] Quick action row: Call, Email, Edit
  - [ ] Transaction history as a scrollable list below
- [ ] **Chart of Accounts — mobile layout:**
  - [ ] Grouped list by account type (collapsible sections: Assets, Liabilities, Equity, Revenue, Expense)
  - [ ] Each row: account name, number (if set), balance
  - [ ] "View Register" and "Run Report" as tap actions on each row
  - [ ] Balance numbers right-aligned
- [ ] **Account Register — mobile layout:**
  - [ ] Card-based transaction list (not a table grid — tables don't work at 320px)
  - [ ] Each card: date, payee, memo snippet, amount (payment or deposit), running balance
  - [ ] Reconciliation status: small badge on the card (C / R)
  - [ ] Inline entry: tapping the FAB opens a bottom sheet with the entry form (type selector + fields)
  - [ ] Inline edit: tapping a card opens the edit bottom sheet
  - [ ] Filter and search in a collapsible toolbar
  - [ ] Account switcher as a dropdown in the header
- [ ] **Reports — mobile layout:**
  - [ ] Report toolbar: date range and filters collapse into a "Configure" button → bottom sheet
  - [ ] Report data:
    - Simple reports (P&L, Balance Sheet): render as an indented list with expand/collapse per section
    - Tabular reports (transaction list, AR aging): card list or horizontally scrollable table with sticky first column
    - Charts: full width, touch-enabled (tap data points to see values)
  - [ ] Export buttons: single "Export" button → bottom sheet with CSV/PDF/Print options
  - [ ] Drill-down: tap any amount → navigate to filtered transaction list
- [ ] **Banking — mobile layout:**
  - [ ] Bank connections: card list with connection status, last sync, "Sync Now" button
  - [ ] Bank feed: card list with date, description, amount, suggested category
  - [ ] Categorize action: tap card → bottom sheet with account selector, payee, memo, save
  - [ ] Bulk approve: select mode (checkboxes on cards) → "Approve Selected" sticky button
  - [ ] Reconciliation: simplified view — scrollable list with checkboxes, running totals sticky at top
- [ ] **Settings — mobile layout:**
  - [ ] Stacked sections (Company Profile, Preferences, Appearance, System)
  - [ ] Full-width forms
  - [ ] Logo upload: tap to open camera or file picker
- [ ] **Setup Wizard — mobile layout:**
  - [ ] Full-screen steps (one step per screen)
  - [ ] Step indicator: horizontal dots at top (not the full step bar)
  - [ ] All inputs full-width
  - [ ] "Next" / "Back" buttons sticky at bottom
  - [ ] Credentials download: button saves file; includes a "Copy to clipboard" alternative for mobile
- [ ] **Batch Entry — desktop only gate:**
  - [ ] On mobile viewports (< 768px), the Batch Entry sidebar link shows an info page: "Batch entry is designed for desktop browsers. Please open KIS Books on a computer to use this feature."
  - [ ] The route renders the info page, not a broken grid
  - [ ] No attempt to make the spreadsheet grid responsive — it would be unusable
- [ ] **Modals — mobile adaptation:**
  - [ ] Modals with form content become full-screen bottom sheets on mobile (slide up from bottom)
  - [ ] Confirmation dialogs remain centered modals (smaller footprint)
  - [ ] Bottom sheets: drag handle at top, swipe down to dismiss, content scrollable
- [ ] **Tables → Cards pattern:**
  - [ ] Create `packages/web/src/components/ui/ResponsiveTable.tsx` — renders a `<table>` on desktop and a card list on mobile, driven by the same data and column definitions
  - [ ] Column priority system: each column has a `priority` (1 = always visible, 2 = hidden below tablet, 3 = hidden below desktop). On mobile, only priority-1 columns show in the card; tapping expands to show all.

### 7.9 Ship Gate
- [ ] Sidebar shows font size controls (A−, A, A+) and theme toggle at all times
- [ ] Clicking A+ increases font size one level, A− decreases, A resets to default
- [ ] Dot indicator shows current level
- [ ] A+ disabled at level 5, A− disabled at level 1
- [ ] Font scale changes apply instantly to all visible content without page reload
- [ ] Theme toggle cycles Light → Dark → System → Light
- [ ] Icon updates per state (sun / moon / monitor)
- [ ] Dark mode: all text readable, no white-on-white or black-on-black anywhere
- [ ] Dark mode: charts, badges, tags, semantic colors all legible
- [ ] System mode: follows OS preference, switches in real-time when OS setting changes
- [ ] Preferences persist across page refreshes (localStorage)
- [ ] Preferences persist across logouts and logins (server-side)
- [ ] No theme flash on page load (inline script applies before React renders)
- [ ] Invoice PDF renders in light theme regardless of user's dark mode setting
- [ ] Print output is always light theme
- [ ] Settings page shows detailed controls with preview
- [ ] Font scale XL: no layout breaks on any page
- [ ] Font scale XS: text readable, touch targets adequate
- [ ] WCAG AA contrast ratios met for all text in both themes
- [ ] **Mobile (375px viewport):** sidebar is off-canvas drawer, opens/closes via hamburger
- [ ] **Mobile:** bottom nav bar shows 5 primary destinations
- [ ] **Mobile:** dashboard renders single-column, all data visible without horizontal scroll
- [ ] **Mobile:** transaction list renders as card list, searchable, filterable via bottom sheet
- [ ] **Mobile:** can create an expense via FAB → type picker → form → save (full flow works)
- [ ] **Mobile:** invoice list as card list, tap to view detail, can send and record payment
- [ ] **Mobile:** contact list as card list, tap-to-call and tap-to-email work
- [ ] **Mobile:** chart of accounts as grouped list, "View Register" tap action works
- [ ] **Mobile:** account register as card list with running balance, inline entry via bottom sheet
- [ ] **Mobile:** reports render readable — P&L as collapsible list, tabular reports horizontally scrollable
- [ ] **Mobile:** bank feed categorization works via bottom sheet
- [ ] **Mobile:** reconciliation works with checkbox list and sticky totals
- [ ] **Mobile:** setup wizard completes fully on a phone screen
- [ ] **Mobile:** batch entry route shows desktop-only message, not a broken grid
- [ ] **Tablet (768px):** two-column layouts where appropriate, sidebar as collapsible rail
- [ ] **Touch targets:** all interactive elements ≥ 44px × 44px on mobile
- [ ] **No horizontal scroll** on any mobile screen (except intentionally scrollable tables with sticky columns)
- [ ] Dark mode + mobile: verified on all screens — no color issues specific to mobile viewport
- [ ] Font scale XL + mobile: verified — content reflows, no overflow
- [ ] All Vitest tests passing
- [ ] Playwright mobile viewport E2E tests passing
- [ ] QUESTIONS.md reviewed and resolved

---

## 8. UX Notes

### Sidebar Control Sizing

The sidebar controls must stay compact. The font size buttons are 28px square, the theme toggle is 28px square. Total width of the control strip fits within the collapsed sidebar width. On mobile (sidebar collapsed), the controls move to a bottom sheet or app header bar.

### Dark Mode Quality Bar

Dark mode is not "invert everything." Specific rules:

- **Backgrounds lift, not invert.** Light mode bg is #FFFFFF; dark mode bg is #1A1A1E (not black). Cards in dark mode are #242428 (slightly lighter than bg) — this creates depth.
- **Text dims, not inverts.** Primary text in dark mode is #E8E8E8 (not pure white — reduces eye strain). Secondary text is #A0A0A0.
- **Borders get subtler.** Borders use reduced opacity in dark mode (8–18% white) so they don't dominate.
- **Semantic colors desaturate slightly.** Success/warning/danger backgrounds are deep, muted versions of their light counterparts. Text for these uses the brighter stops of the color ramp.
- **No pure black backgrounds.** The darkest surface is #18181C (sidebar). This avoids the "OLED black" look that creates excessive contrast.

### Accessibility

- All color combinations must pass WCAG AA (4.5:1 for normal text, 3:1 for large text)
- Font scale at XS (13px) must still be readable — this is the floor
- Font scale at XL (20px) must not break layouts — test on 1280px viewport minimum
- Reduced motion: theme transitions respect `prefers-reduced-motion` (disable the 0.2s transition if set)
- Screen readers: theme/font controls have proper ARIA labels ("Increase text size", "Switch to dark mode")

### Future Extensions (Not in This Plan)

- **Compact mode:** reduce padding and whitespace for power users (like an accountant view)
- **Custom accent color:** let users pick their own brand color for active states and buttons
- **High contrast mode:** WCAG AAA compliance option
- **Sidebar position:** left vs right
- **Density options:** comfortable / cozy / compact (affects table row height, card spacing)
- **Native mobile app:** PWA service worker for offline support, or React Native wrapper

---

## 9. Responsive Design System

### 9.1 Breakpoints

Four breakpoints defined as Tailwind custom screens and available as CSS variables and JS hooks:

| Token | Width | Label | Device Target |
|---|---|---|---|
| `sm` | 0–639px | **Phone** | iPhone SE through iPhone Pro Max (portrait) |
| `md` | 640–1023px | **Tablet** | iPad Mini through iPad Pro (portrait), phones landscape |
| `lg` | 1024–1439px | **Desktop** | Laptop screens, iPad Pro landscape |
| `xl` | 1440px+ | **Desktop large** | External monitors, ultrawide |

```javascript
// tailwind.config.ts
screens: {
  sm: '640px',    // min-width: tablet and up
  md: '768px',    // min-width: wider tablet and up (sideline breakpoint)
  lg: '1024px',   // min-width: desktop
  xl: '1440px',   // min-width: large desktop
}
```

**Design approach:** mobile-first. Base styles target phone (< 640px). `sm:`, `md:`, `lg:`, `xl:` prefixes add complexity upward.

### 9.2 Layout Tiers

Three distinct layout shapes:

**Phone (< 640px):**
- Sidebar: hidden, opens as off-canvas drawer via hamburger
- Bottom nav bar: 5 fixed tabs
- Content: single column, full width
- Tables: replaced with card lists
- Modals: become full-screen bottom sheets
- Forms: single column, full-width inputs
- FAB: floating action button for primary create action

**Tablet (640px – 1023px):**
- Sidebar: collapsible rail (icons only, expands on hover or tap)
- No bottom nav bar
- Content: flexible, some two-column layouts
- Tables: horizontal scroll with sticky first column (or condensed columns)
- Modals: centered, 90% viewport width
- Forms: two-column where fields are short (date + amount side by side)

**Desktop (1024px+):**
- Sidebar: always visible, full width with labels
- Content: max-width container (1200px) centered, or full-width for data-dense pages
- Tables: full table layout
- Modals: centered, max-width 600px (forms) or 800px (previews)
- Forms: two-column layout where appropriate

### 9.3 App Shell Responsive Behavior

```
PHONE (< 640px)                    TABLET (640-1023px)              DESKTOP (1024px+)
┌────────────────────┐             ┌──┬─────────────────┐          ┌──────────┬─────────────────┐
│ ☰  Page Title   👤 │  ← top bar │  │                 │          │          │                 │
├────────────────────┤             │  │                 │          │ Sidebar  │                 │
│                    │             │  │    Content      │          │ (full)   │    Content      │
│    Content         │             │  │                 │          │          │                 │
│    (full width)    │             │  │                 │          │          │                 │
│                    │             │  │                 │          │          │                 │
│                    │             │  │                 │          │          │                 │
├────────────────────┤             └──┴─────────────────┘          └──────────┴─────────────────┘
│ 🏠 📋 📄 🏦 ···  │  ← bottom     ↑ icon rail
└────────────────────┘    nav
```

### 9.4 Navigation Patterns

**Bottom Navigation Bar (phone only):**

5 tabs, each with an icon and a short label:

| Icon | Label | Route |
|---|---|---|
| Home | Dashboard | `/` |
| List | Transactions | `/transactions` |
| File | Invoices | `/invoices` |
| Bank | Banking | `/banking` |
| Menu | More | opens full menu |

The "More" tab opens a full-screen menu containing all remaining navigation items: Contacts, Chart of Accounts, Reports, Tags, Settings, Batch Entry (desktop only note), and Logout.

**Sidebar Drawer (phone):**
- Hamburger icon in top bar
- Full navigation list (same as desktop sidebar)
- Display controls at bottom of drawer (font size + theme toggle)
- Tap outside or swipe left to close
- Closes automatically on route navigation

**Sidebar Rail (tablet):**
- Narrow strip (56px) with icons only
- Hover or tap to expand temporarily to full width with labels
- Active route highlighted
- Display controls in collapsed state: icon-only theme toggle, font size accessible via expanded state

### 9.5 Data Density Adaptations

**Tables → Cards Pattern**

On mobile, data tables are not usable. Instead, the same data renders as a vertical card list.

A `ResponsiveTable` component handles this with column priorities:

```typescript
interface ColumnDef<T> {
  key: keyof T;
  header: string;
  priority: 1 | 2 | 3;  // 1 = always shown, 2 = tablet+, 3 = desktop+
  render?: (value: any, row: T) => ReactNode;
  align?: 'left' | 'right';
  width?: string;
  mobileLabel?: string;  // override header for mobile card
}
```

- **Priority 1** columns appear in the card summary (always visible)
- **Priority 2** columns appear on tablet but hidden in phone card summary (visible on tap-to-expand)
- **Priority 3** columns appear on desktop table only

Example for transaction list:

| Column | Priority | Phone Card | Tablet Table | Desktop Table |
|---|---|---|---|---|
| Date | 1 | ✓ | ✓ | ✓ |
| Payee | 1 | ✓ | ✓ | ✓ |
| Amount | 1 | ✓ | ✓ | ✓ |
| Type | 1 | ✓ (badge) | ✓ | ✓ |
| Ref No. | 2 | expand | ✓ | ✓ |
| Status | 2 | expand | ✓ | ✓ |
| Memo | 3 | expand | hidden | ✓ |
| Tags | 3 | expand | hidden | ✓ |
| Account | 3 | expand | hidden | ✓ |

**Bottom Sheets Pattern**

Filters, pickers, and action menus that are dropdowns or inline panels on desktop become bottom sheets on mobile:

- Slide up from bottom of viewport
- Drag handle at top
- Swipe down to dismiss
- Content scrolls independently
- Backdrop overlay behind

Used for: filter panels, transaction type pickers, account/contact selectors, export options, action menus.

### 9.6 Touch Interaction Patterns

| Interaction | Desktop | Mobile |
|---|---|---|
| Navigate to detail | Click row | Tap card |
| Quick actions | Hover → action buttons | Long-press → action menu, or swipe gestures |
| Multi-select | Checkbox column | Selection mode toggle → checkboxes on cards |
| Inline edit | Click to expand row | Tap card → bottom sheet form |
| Drag to reorder | Mouse drag | Touch drag (with haptic feedback if supported) |
| Hover tooltips | On hover | On long-press (300ms) |
| Context menu | Right-click | Long-press |
| Dropdown close | Click outside | Tap outside or swipe down |

### 9.7 Form Adaptations

Forms on mobile follow these rules:

- **Single column always.** No side-by-side fields on phone (< 640px), even for short fields like date + amount.
- **Full-width inputs.** Every input, select, and textarea spans 100% width.
- **Native pickers preferred.** Date inputs use `type="date"` on mobile to trigger the native OS date picker. Account and contact selectors open as full-screen searchable lists.
- **Sticky action buttons.** "Save" and "Cancel" buttons fixed to the bottom of the viewport, always reachable without scrolling.
- **Keyboard-aware layout.** When the soft keyboard opens, the form scrolls to keep the active input visible. No content hidden behind the keyboard.
- **Touch targets ≥ 44px.** All buttons, checkboxes, toggles, and tappable elements have a minimum tap area of 44 × 44px.

### 9.8 Report Adaptations

Reports need special treatment because they're inherently data-dense.

**Simple financial statements (P&L, Balance Sheet):**
- Render as an indented list with expand/collapse sections
- Account names left-aligned, amounts right-aligned
- Section headers (Revenue, Expenses, Assets, Liabilities) are collapsible
- Totals and subtotals shown in bold
- Tap any amount to drill down

**Tabular reports (Transaction List, AR Aging, General Ledger):**
- Horizontally scrollable table with sticky first column (date or name)
- Reduced columns: hide lower-priority columns, show on rotate-to-landscape prompt
- Alternative: card list mode (same as transaction list cards)

**Charts:**
- Full viewport width
- Reduced height (200px on phone vs 300px on desktop)
- Touch-enabled: tap bars/points to see values in a tooltip
- Legend positioned below chart (not beside it)

**Export:**
- Single "Export" button → bottom sheet with options (CSV, PDF, Print)
- PDF generates server-side (no browser print dialog complexity on mobile)

### 9.9 Screens Excluded from Mobile

| Screen | Mobile Behavior |
|---|---|
| **Batch Entry** | Route renders an info page: "Batch entry requires a desktop browser. The spreadsheet grid needs a keyboard and a wider screen to be usable. Please open KIS Books on a computer for batch entry." With a "Go to Dashboard" button. |
| **Invoice Template Editor** | Usable but limited — color picker and field toggles work; live preview is vertically stacked. Acceptable but not ideal. Not excluded, just simplified. |

### 9.10 Viewport Meta Tag

The `<meta>` viewport tag in `index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=yes">
```

- `user-scalable=yes`: don't block pinch-to-zoom (accessibility requirement)
- `viewport-fit=cover`: extend content to fill notch/safe-area on modern phones
- Safe area insets: use `env(safe-area-inset-bottom)` for the bottom nav bar and sticky buttons on notched devices

### 9.11 Testing Strategy

- [ ] Playwright mobile viewport tests using `viewport: { width: 375, height: 812 }` (iPhone 13/14)
- [ ] Playwright tablet viewport tests using `viewport: { width: 768, height: 1024 }` (iPad)
- [ ] Test all three layout tiers: phone, tablet, desktop
- [ ] Test landscape orientation on phone (667 × 375)
- [ ] Test touch interactions: long-press, swipe gestures
- [ ] Test with soft keyboard open: form inputs remain visible
- [ ] Cross-browser: Chrome mobile, Safari iOS, Firefox Android
- [ ] Test dark mode + mobile combination on all key screens
- [ ] Test font scale XL + mobile combination (content must reflow, not overflow)
