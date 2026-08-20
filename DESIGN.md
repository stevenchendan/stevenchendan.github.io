# Portfolio design system

## Intent

The site should feel calm, credible and technically precise. It is a professional portfolio, not a product launch page. Prioritise comprehension, evidence and accessibility over spectacle.

## Visual direction

- Use a warm off-white canvas with near-black text.
- Use one teal accent for links, focus rings and the primary action only.
- Create hierarchy with spacing, hairline borders and subtle surface changes. Avoid decorative gradients and heavy shadows.
- Keep content editorial: short introductions, descriptive headings and concrete outcomes.

## Tokens

- Canvas: `#f7f6f2`
- Elevated surface: `#fffefb`
- Soft surface: `#efeee9`
- Ink: `#17201f`
- Muted ink: `#65706d`
- Hairline: `#dcded8`
- Accent: `#176b5b`
- Focus ring: `rgba(23, 107, 91, 0.28)`
- Content width: `1120px`
- Reading width: `720px`
- Spacing unit: `4px`
- Section gap: `96px` desktop, `72px` mobile
- Radius: `6px` controls, `10px` content surfaces

## Typography

- Use Inter with the system sans-serif stack as fallback.
- Body: 16px / 1.65 / 400.
- Lead: 19px / 1.65 / 400.
- Display: 56-68px / 1.04 / 600, with restrained negative tracking.
- Section heading: 36-44px / 1.12 / 600.
- Metadata: 12-13px / 1.4 / 600, with slight positive tracking.
- Use monospace only for code or technical identifiers.

## Layout and components

- Keep the header compact and place the primary information above the fold.
- Project entries should read as case studies: context, contribution, outcome, then technologies.
- Use dividers for timelines and lists. Do not put every content block in a card.
- Reserve elevated panels for selected work or high-priority calls to action.
- Interactive targets must be at least 44px high on touch devices.
- All interactive elements require visible hover and keyboard-focus states.

## Responsive behaviour

- Collapse multi-column content to one column below 760px.
- Preserve reading order: heading, context, contribution, outcome, technologies.
- Never rely on hover to reveal information.
- Avoid horizontal scrolling at 320px and above.

## Do

- Lead with current role and useful evidence.
- Prefer plain language and short paragraphs.
- Keep accent usage sparse and consistent.
- Respect `prefers-reduced-motion`.

## Do not

- Do not add marquees, glowing gradients, spotlight effects or animated backgrounds.
- Do not use oversized type that pushes all meaningful content below the fold.
- Do not use more than one chromatic accent.
- Do not turn technology tags into the dominant visual element.
- Do not add generic stock imagery or decorative mockups.
