# Pack Menu Kit

This folder centralizes the small list-button layer for:

- Pack selector rows (`.pack-item`)
- Question selector rows (`.question-item`)
- Mobile list toggle buttons (`#pack-drawer-toggle`, `#question-drawer-toggle`)

## Files

- `pack-menu-kit.js`: reusable row creation helpers exposed as `window.PackMenuKit`
- `pack-menu-kit.css`: compact style layer for list/toggle interactions

## Integration

Included by:

- `index.html`
- `legacy/index.html`

Load order:

1. `style.css`
2. `pack-menu-kit/pack-menu-kit.css`
3. `packs/pack-registry.js`
4. `pack-menu-kit/pack-menu-kit.js`
5. `script.js`

This keeps pack list button styling and rendering logic grouped in one root-level package folder.

