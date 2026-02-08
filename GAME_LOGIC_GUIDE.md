# Game Logic Builder Guide

This guide explains how to build quest logic, what each trigger/condition/action does, and how to handle start‑of‑game reveals.

## Quick Start

1. Place icons/items on the map (monsters, furniture, tiles, markings, etc.).
2. Open **Game Logic Builder**.
3. Select a map item from the left list.
4. Pick a trigger (e.g., `onSearch`, `onEnterTile`, `onStart`).
5. Add conditions if needed.
6. Add actions (e.g., `revealTiles`, `revealEntities`, `addNarrative`).
7. Use **Add Trigger** to attach another independent trigger to the same icon.
8. Save logic.

## Triggers

- `onStart`
  - Fires once at the start of a fresh play session.
  - Best for initial reveals around the start position.
- `onEnterTile`
  - Fires when a hero enters a tile **adjacent** to the icon (including the icon tile itself).
  - This supports furniture/objects that occupy a tile you cannot stand on.
- `onReveal`
  - Fires when an area is revealed (e.g., open door reveal or manual reveal).
- `onOpenDoor`
  - Fires when **Open Door** is used and a door is found in the selected region.
- `onSearch`
  - Fires when **Search** is used for a region.
- `custom`
  - Reserved for future custom hooks. Use with care.

### Multiple Triggers Per Icon

An icon can have multiple independent triggers. Each trigger has its own conditions and actions,
so a chest can do things like:

- `onSearch` → reveal the chest entity
- `onEnterTile` → reveal a card or a note

Use the trigger chips under the icon header to switch between triggers, and **Add Trigger** to
create another one.

## Conditions

Conditions are optional. If none exist, the logic always runs.

- **All conditions (AND)**: every condition must pass.
- **Any condition (OR)**: at least one condition must pass.

Condition types:

- `flagSet`
  - True if the named flag is `true`.
  - Operand: flag name (string).
- `flagUnset`
  - True if the named flag is `false` or missing.
  - Operand: flag name (string).
- `flagExists`
  - True if the flag has ever been set/cleared (exists in state).
  - Operand: flag name (string).
- `noteExists`
  - True if a Quest Note with the chosen ID exists in this quest.
  - Operand: note ID (selected from dropdown).
- `custom`
  - Always treated as `true` (placeholder for future extensions).

## Actions

- `revealTiles`
  - Reveals the exact tiles you select (via text input or drag‑select on the map).
- `revealRadius`
  - Reveals tiles within a radius around the icon the logic is attached to.
  - Payload: `radius` (tile distance).
  - For multi‑tile items, the top‑left tile is used as the origin.
- `revealEntities`
  - Reveals selected map items (monsters, furniture, tiles, markings, etc.).
- `addNarrative`
  - Reveals selected Quest Notes.
- `revealCard`
  - Reveals selected cards from the card library.
- `setFlag`
  - Sets a named flag to `true`.
- `clearFlag`
  - Sets a named flag to `false`.
- `addObjective`
  - Adds a text objective ID to the session state (used for tracking goals).

## Start Position Logic (Recommended Pattern)

**Goal:** Reveal the starting area automatically when a play session begins.

1. Place a **start marker** on the map (e.g., Arrow or Number).
2. Select that marker in Game Logic Builder.
3. Set **Trigger** to `onStart`.
4. Add an action **`revealRadius`** with a radius (e.g., `2`).
5. Optionally add `setFlag` (e.g., `game-started`) for bookkeeping.

This runs once at the start of a fresh session and clears the area around the start marker.

## Default Visibility

If an item sits on a tile that has been revealed, it will render automatically in Play mode
(even without explicit logic). Doors and multi‑tile items count as visible if **any** tile they
occupy has been revealed.

If an icon has an `onSearch` trigger, it is **kept hidden** until the search logic explicitly
reveals it (use a `revealEntities` action for that icon).

## Suggested Patterns

- **One‑time room reveals**
  - Trigger: `onEnterTile` or `onReveal`
  - Condition: `flagUnset` (e.g., `room-1-revealed`)
  - Actions: `revealTiles`, `revealEntities`, `addNarrative`, `setFlag`

- **Search logic**
  - Trigger: `onSearch`
  - Actions: `addNarrative` + `revealEntities` (traps/secret doors)

- **Door logic**
  - Trigger: `onOpenDoor`
  - Actions: `revealTiles`, `revealEntities`, `addNarrative`

## Tips

- **Use flags** to prevent repeating the same reveal.
- **Use numbered markings** to link tiles to Quest Notes.
- **Keep triggers specific**: logic attaches to the selected icon only.
