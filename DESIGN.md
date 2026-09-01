# Design: an engineering-instrument UI

This document captures the visual language for Moe's prototype UI — the
philosophy behind it, the principles that follow from it, and the concrete
tactics used to implement it. It replaces the soft, rounded, shadow-heavy
default we started with (standard shadcn/ui).

Reference: [usgraphics.com](https://usgraphics.com) — not to copy, but as a
north star for what "engineering instrument" means as a genre, distinct from
both generic SaaS softness and our earlier handwritten-notebook detour.

## Philosophy

Moe manages the physical things in someone's life — the same category of
concern as an inspection log, a work order, a spec sheet. The UI should read
like an instrument built for that job: legible, dense where it earns its
density, and honest about what the system is doing. It should not read like
a consumer chat toy, and it should not perform "handmade" — no handwriting
fonts, no paper texture, no whimsy. The personality comes from precision,
not decoration.

Borrowed directly from U.S. Graphics Company's own stated philosophy, the
parts that apply here:

- **Expose state and inner workings.** Don't hide what the agent did behind
  a vague spinner or a cute label — show it.
- **Dense, not sparse.** Prefer showing more real information over
  whitespace-as-luxury.
- **Explicit is better than implicit.** Status is a labeled value, not a
  color you have to interpret.
- **Diametrically opposed to soft-minimalism.** Structure comes from rules
  and borders, not from shadows and roundness implying depth that isn't
  there.
- **Don't infantilize users.** No unnecessary hand-holding copy, no
  over-friendly tone in the chrome.

## Principles

1. **Structure is borders, not elevation.** Flat fills and 1px hairline
   rules replace rounded corners and drop shadows. If two things are
   grouped, a border says so — nothing "floats."
2. **Monospace is reserved for data.** Anything that is a value — an id, a
   timestamp, a status, a count, a category — is set in mono. Prose
   (chat messages, descriptions, care notes) stays in the sans body face.
   Never the reverse.
3. **One accent color, used only for interaction.** A single accent (blue)
   carries every interactive/active state — links, primary actions, active
   nav, focus. Red/amber/green are semantic only (overdue / due-soon /
   confirmed) and never used decoratively.
4. **The grid is literal structure, not wallpaper.** Where the data is
   tabular (the maintenance queue), it's a real table with rows and
   columns — not a card grid pretending to be organized.
5. **Density over whitespace-as-luxury.** Show more of the real content at
   once. Padding exists to separate, not to give things room to "breathe"
   for its own sake.
6. **State is a plain-language record, not a command.** What the agent did
   is shown as a labeled field/value/status row — e.g. `Subject logged —
   4Runner — OK` — reusing the same row shape as the maintenance ledger.
   Never rendered as a shell command; this product is not for developers.

## Tactics

Concrete, implementable rules derived from the principles above.

### Color

- Base neutrals: an off-white "paper" canvas (`#fbfaf7` light / `#131310`
  dark), a slightly-lifted panel color for sidebar/sunken areas, and a
  single hairline border color (`--line`) plus a stronger one
  (`--line-strong`, near-black/near-white) for emphasis rules.
- One accent: a mid blue (`#1d4ed8` light / `#6f97f2` dark) — every button,
  active nav state, focus ring, and link.
- Semantic only: red (overdue), amber (this week / due soon), green
  (confirmed/OK). Never used for anything that isn't literally that state.
- No gradients, no soft glassy blur.

### Typography

- Body/UI face: Geist Sans (already loaded via `next/font` as
  `--font-geist`) — a clean grotesk, used for prose, headings, labels.
- Data face: Geist Mono (`--font-geist-mono`, already loaded) — used
  exclusively for ids, timestamps, counts, statuses, table headers, and
  the activity-record rows. Small size, slight letter-spacing on
  uppercase labels.
- No display/handwritten face. No third font.

### Shape & elevation

- `--radius: 0` (or near-0, ≤2px) everywhere. No `rounded-xl` cards.
- Borders replace shadows as the primary structural device. Where a shadow
  is used at all (e.g. the composer), it's a single soft blur, not stacked
  elevation.

### Components

- **Cards → bordered panels/rows.** `Card` keeps its API but renders flat:
  1px border, square corners, no shadow.
- **Nav → bordered stacked rows**, active state marked by a left accent
  bar + tinted background, not a solid fill block.
- **Badges/status → bordered tags**, not soft pill fills: small mono
  text, 1px border in the semantic color, tinted (not solid) background.
- **Maintenance queue → a real table.** Columns: status tag, item, subject,
  actions. Not a card grid.
- **Subject detail → a labeled spec sheet.** `label : value` rows with a
  hairline rule between them, not prose paragraphs in a card.
- **Tool activity in chat → an activity record**, reusing the maintenance
  ledger's row shape: `FIELD` (mono label) · value (plain language) ·
  status tag (`OK`/`ERROR`/running). Never a shell command.
- **Buttons → bordered rectangles.** Primary = accent fill; secondary =
  outline. No pill shapes.

### Layout

- Sidebar + content, both boxed with hairline borders rather than
  floating panels.
- Content density: prefer showing the full maintenance queue as rows over
  paginating or collapsing by default.

## What we explicitly rejected

- Handwritten/display fonts (Kalam, Caveat, Permanent Marker) — read as
  crafts/notebook, not engineering.
- Grid-paper background textures — decorative, fights legibility, not
  worth the "cute" tradeoff.
- Shell-command styling for tool activity (`$ create_subject --name ...`) —
  correct principle (expose state), wrong register (developer tool, not a
  consumer product).
- Soft rounded cards + drop shadows — the default shadcn look; reads as
  generic SaaS, undermines the instrument feel.
