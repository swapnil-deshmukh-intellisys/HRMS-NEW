# Premium Color Palette & Design Tokens

This document records the premium colors and linear gradients used in the HRMS application (primarily on the Departments and Leaderboard pages). These tokens will serve as the foundation for the upcoming theme toggler and custom color themes.

---

## 1. Department & Avatar Gradients
These 6 modern, vibrant linear gradients are used for department cards, employee initial avatars, and status highlights to create a premium, gamified look.

| Theme | Hex Gradient Range | CSS Code | Visual Description |
| :--- | :--- | :--- | :--- |
| **Purple** | `#a855f7` → `#c084fc` | `linear-gradient(135deg, #a855f7, #c084fc)` | Vibrant purple to light violet |
| **Pink** | `#ec4899` → `#f472b6` | `linear-gradient(135deg, #ec4899, #f472b6)` | Bright pink to soft rose |
| **Blue** | `#3b82f6` → `#60a5fa` | `linear-gradient(135deg, #3b82f6, #60a5fa)` | Electric blue to sky blue |
| **Emerald** | `#10b981` → `#34d399` | `linear-gradient(135deg, #10b981, #34d399)` | Mint emerald to light teal |
| **Amber** | `#f59e0b` → `#fbbf24` | `linear-gradient(135deg, #f59e0b, #fbbf24)` | Warm amber to golden yellow |
| **Red** | `#ef4444` → `#f87171` | `linear-gradient(135deg, #ef4444, #f87171)` | Coral red to light crimson |

---

## 2. Core Application Theme Colors
The primary theme colors used to build the dark-mode dashboard interface.

### A. Primary Brand Accents
*   **Accent Gradient** (Used for primary buttons, active links, and highlights):
    *   `linear-gradient(135deg, #4f46e5, #7c3aed)` (Indigo `#4f46e5` to Violet `#7c3aed`)
*   **Accent Glow / Shadow**:
    *   `rgba(124, 58, 237, 0.25)` (Violet glow shadow)

### B. Backgrounds & Surfaces
*   **App Background** (`--color-bg`): `#0f172a` (Slate 900)
*   **Card / Box Surface** (`--color-surface`): `#1e293b` (Slate 800)
*   **Nested / Hover Surface** (`--color-surface-hover`): `#2d3748` (Slate 750)
*   **Border / Divider**: `#334155` (Slate 700)

### C. Typography
*   **Text Strong** (Titles, Headings): `#f8fafc` (Slate 50)
*   **Text Default** (Body text): `#cbd5e1` (Slate 300)
*   **Text Muted** (Captions, Placeholders): `#64748b` (Slate 500)

---

## 3. Theme Toggler Implementation Plan

When implementing the theme toggler, we can define these colors as CSS Custom Properties (Variables) inside the `:root` element and swap them using a data attribute (e.g. `data-theme="light"` or `data-theme="purple"`).

### Example CSS Variables Structure
```css
/* Default Dark Theme */
:root {
  --color-bg: #0f172a;
  --color-surface: #1e293b;
  --color-border: #334155;
  --color-text-strong: #f8fafc;
  --color-text-default: #cbd5e1;
  --color-text-muted: #64748b;
  
  --color-accent-primary: #7c3aed;
  --color-accent-gradient: linear-gradient(135deg, #4f46e5, #7c3aed);
}

/* Light Theme Override */
[data-theme="light"] {
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-border: #e2e8f0;
  --color-text-strong: #0f172a;
  --color-text-default: #334155;
  --color-text-muted: #64748b;
  
  --color-accent-primary: #4f46e5;
  --color-accent-gradient: linear-gradient(135deg, #6366f1, #4f46e5);
}
```
