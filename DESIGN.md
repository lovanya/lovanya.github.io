---
name: Lin Jian Portfolio
version: "1.0"
description: Personal developer portfolio with dark mode, i18n, and interactive resume

colors:
  primary: "#3b82f6"
  primary-hover: "#2563eb"
  primary-glow: "rgba(59, 130, 246, 0.1)"
  surface: "#ffffff"
  surface-secondary: "#f8fafc"
  surface-card: "#ffffff"
  text: "#0f172a"
  text-secondary: "#64748b"
  border: "#e2e8f0"
  error: "#dc2626"
  success: "#16a34a"

  dark:
    primary: "#60a5fa"
    primary-hover: "#93c5fd"
    primary-glow: "rgba(96, 165, 250, 0.15)"
    surface: "#0f172a"
    surface-secondary: "#1e293b"
    surface-card: "#1e293b"
    text: "#f1f5f9"
    text-secondary: "#94a3b8"
    border: "#334155"

typography:
  font-family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans SC', sans-serif"
  h1:
    fontSize: 3rem
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  h2:
    fontSize: 1.75rem
    fontWeight: 700
    lineHeight: 1.3
  h3:
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5

rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px

spacing:
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2rem
  2xl: 3rem
  3xl: 4rem
  4xl: 6rem

shadows:
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)"
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)"
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"
  dark-sm: "0 1px 2px 0 rgb(0 0 0 / 0.3)"
  dark-md: "0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)"
  dark-lg: "0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.3)"

components:
  container:
    maxWidth: "1200px"
    padding: "0 2.5rem"
  card:
    background: "{colors.surface-card}"
    border: "1px solid {colors.border}"
    borderRadius: "{rounded.lg}"
    padding: "1.5rem"
    hoverBorder: "{colors.primary}"
  button:
    background: "{colors.primary}"
    textColor: "#ffffff"
    borderRadius: "{rounded.lg}"
    padding: "0.625rem 1.25rem"
    fontWeight: 500
  tag:
    background: "{colors.surface-secondary}"
    textColor: "{colors.text-secondary}"
    border: "1px solid {colors.border}"
    borderRadius: "{rounded.full}"
    padding: "0.25rem 0.75rem"
  timeline-dot:
    size: "14px"
    background: "{colors.primary}"
    border: "3px solid {colors.surface}"

layout:
  header:
    height: "64px"
    position: sticky
    backdropBlur: true
    background: "rgba(255, 255, 255, 0.9)"
  section:
    padding: "5rem 0"
  hero:
    minHeight: "70vh"
    gradient: "from-secondary to-surface"

---

# Design System: Lin Jian Portfolio

A personal developer portfolio showcasing 11 years of frontend experience. Clean, modern design with dark mode support and interactive resume components.

## 1. Visual Theme & Atmosphere

The design follows a **Professional Developer** aesthetic with a focus on clarity and technical credibility. The atmosphere is modern, trustworthy, and technically sophisticated without being overwhelming.

- **Light Mode:** Clean white surfaces with subtle blue accents. Professional and readable.
- **Dark Mode:** Deep navy backgrounds with soft blue glows. Technical and immersive.

## 2. Color Palette & Roles

### Light Mode
- **Primary** (#3b82f6): Interactive elements, links, active states, key accents
- **Surface** (#ffffff): Page backgrounds, card backgrounds
- **Surface Secondary** (#f8fafc): Secondary backgrounds, tag backgrounds
- **Text** (#0f172a): Primary text, headings
- **Text Secondary** (#64748b): Descriptions, metadata, timestamps
- **Border** (#e2e8f0): Card borders, dividers, subtle separators

### Dark Mode
- **Primary** (#60a5fa): Interactive elements with slightly brighter blue for contrast
- **Surface** (#0f172a): Main background
- **Surface Card** (#1e293b): Card and component backgrounds
- **Text** (#f1f5f9): Primary text
- **Text Secondary** (#94a3b8): Descriptions and metadata
- **Border** (#334155): Subtle separators

### Usage Rules
- Use Primary for clickable elements and active states
- Reserve dark backgrounds for cards and elevated surfaces
- Use secondary text for non-essential information
- Never use primary color for large background areas

## 3. Typography Rules

- **Font Stack:** System fonts for performance and native feel
- **Headings:** Bold weight (700), tight letter-spacing for impact
- **Body:** Regular weight (400), generous line-height (1.6) for readability
- **Chinese Text:** Uses Noto Sans SC as fallback for proper CJK rendering

### Hierarchy
- H1 (3rem): Page titles, hero text
- H2 (1.75rem): Section headers
- H3 (1.25rem): Card titles, subsections
- Body (1rem): Content paragraphs
- Small (0.875rem): Metadata, labels, tags

## 4. Component Stylings

### Cards
- Rounded corners (12px) for modern feel
- Subtle border with hover accent effect
- Generous internal padding (1.5rem)
- Shadow elevation on hover

### Buttons
- Primary: Solid blue fill with white text
- Outline: Transparent with border, text color
- Rounded corners (12px) for friendly feel
- Subtle transform on hover for interactivity

### Tags
- Pill-shaped (full border radius)
- Muted background with subtle border
- Small size for inline use

### Timeline
- Centered vertical line with alternating left/right cards
- Blue accent dots at each node
- Expandable content sections

### Project Cards
- 3D flip animation for front/back views
- Front: Summary with tech stack tags
- Back: Detailed highlights list

### Circuit Tree (Skill Tree)
- PCB trace aesthetic with right-angle branches
- Central trunk with spreading branches
- Small terminal nodes at endpoints
- Card background with subtle border

## 5. Layout Principles

- **Container:** Max-width 1200px, centered with generous horizontal padding
- **Sections:** 5rem vertical spacing between major sections
- **Grid:** Responsive 1-2-3 column layouts using CSS Grid
- **Whitespace:** Generous breathing room throughout
- **Alignment:** Centered content with left-aligned text within sections

### Responsive Breakpoints
- Mobile: Single column, reduced padding
- Tablet (768px): Two-column grids
- Desktop (1024px+): Full three-column layouts

## 6. Do's and Don'ts

### Do
- Use consistent spacing from the spacing scale
- Maintain proper heading hierarchy
- Test both light and dark modes
- Use descriptive alt text for images
- Keep interactive states visible and clear

### Don't
- Use primary color for large background areas
- Mix too many font weights in one section
- Override the dark mode color variables
- Use low-contrast text colors
- Forget to test on mobile devices

## 7. i18n Notes

- Default language: Chinese (zh)
- Secondary language: English (en)
- Use appropriate font stacks for each language
- Maintain consistent layout across languages
- RTL support not required for this project
