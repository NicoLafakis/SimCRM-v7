# SimCRM UI Rules (Strict)

These rules are mandatory for all new UI elements, pages, and frontend features. Treat them as non-negotiable defaults unless a spec explicitly overrides them.

## Color Palette
- Light Gray Background: `#e8e8e8`
- Slate Gray Frame: `#6c7b7f`
- Charcoal Gray Shell: `#8a8a8a`
- Olive Green Screen: `#8fbc8f`
- Sage Input Fields: `#9fb89f`
- Dark Red Button: `#8b0000`
- Dark Green Text: `#2d3e2d`
- Navy Blue Title: `#1e3a5f`

## Color Usage Guidelines
- Light Gray (`#e8e8e8`): Main background, neutral areas
- Slate Gray (`#6c7b7f`): Container borders, structural elements
- Charcoal Gray (`#8a8a8a`): Shell/background elements for pixel look
- Olive Green (`#8fbc8f`): Primary interface panels, hero sections
- Sage (`#9fb89f`): Input fields, secondary panels
- Dark Red (`#8b0000`): Primary action buttons, important CTAs
- Dark Green (`#2d3e2d`): Text, labels, secondary actions
- Navy Blue (`#1e3a5f`): Logo text, brand elements, headers

## Typography
- Global font: Press Start 2P
- Avoid mixing fonts; if a fallback is needed, ensure visual weight remains consistent.

## Effects & Corners
- Gradients: Avoid unless explicitly pixel-stepped.
- Shadows: Allow hard drop shadows; avoid soft blur glows.
- Corners: Prefer low radii; use asymmetric bevels only when specified.

## Buttons
- Use palette colors (Dark Red for primary, Green for secondary). White text.
- Border: 2–3px solid, dark slate (`#24323a`).
- Shape: Squared/pixel corners (`4–6px` radius max).
- Shadow: `0 6px 0 rgba(0,0,0,0.2)`; press effect may shift by 1px.

## Inputs
- Background: Sage `#9fb89f` for filled areas; transparent overlays allowed on green screens.
- Text: Dark Green `#2d3e2d`.
- Border: 2px solid, `#2f3a2f`.
- Radius: 4px.

## Panels & Screens
- Frames: Slate Gray `#6c7b7f` with solid borders; avoid smooth gradients.
- Green Screens: Olive `#8fbc8f` with crisp dark frame; allow inner bezel using inset box-shadow without blur.

## Spacing
- Use `8px` multiples (8/16/24/32) for margins/gaps.
- Provide breathing room between stacked elements; avoid cramping labels and fields.

## Accessibility
- Ensure focus outlines are visible (e.g., magenta focus ring aligned with existing patterns).
- Maintain sufficient color contrast for text and interactive elements.

## Examples
- See `src/components/AuthPage.jsx` and `src/styles.css` for reference implementation.
