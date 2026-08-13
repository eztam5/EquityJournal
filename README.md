# EquityJournal

A local-first desktop application for investment research, company notes, watchlists, and faceted hierarchical classifications.

## Technology

- Tauri 2 desktop shell
- React 19 and TypeScript
- Vite
- SQLite via the official Tauri SQL plugin
- Tiptap rich-text editor
- Vitest

## Run the desktop application

Rust was installed with `rustup` while setting up this project. A newly opened terminal automatically includes Cargo on its path.

```sh
npm install
npm run tauri dev
```

The desktop application uses `equity-journal.sqlite3` in Tauri's application-data directory. Migrations run automatically during database initialization.

## Browser-only UI development

```sh
npm run dev
```

The browser version uses local storage as a development database because the Tauri SQLite plugin is available only inside the desktop application. It has the same repository contract, validations, and behavior, but its data is separate from the desktop SQLite database.

## Verification

```sh
npm test
npm run build
npm run tauri build
```

## Current functionality

- Resizable navigation sidebar
- Create, edit, open, and delete securities
- Delete confirmation using the company name
- Create watchlists and drag securities onto them
- Create taxonomies with descriptions and colors
- Arbitrarily deep tag trees with context menus and preserved expansion
- Assign multiple classifications to each security
- Five recently viewed securities
- Dark, light, and system themes with persistence and a native macOS View menu
- Per-security rich-text notes with autosave
- Paragraph, Heading 1, and Heading 2
- Bold, italic, underline, strikethrough, text color, and highlight color
- Bulleted and numbered lists with Tab and Shift+Tab nesting
- Links and editable tables with row/column controls

## Existing Qt database

The new schema intentionally retains the Qt application's table and column names. Do not overwrite the Qt database while comparing applications. Copy it first, then place the copy at the Tauri database location before launching EquityJournal. The idempotent initial migration adds migration metadata without recreating existing tables.
