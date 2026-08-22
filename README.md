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


## Releasing a new version
update the version in these files:
package.json
src-tauri/Cargo.toml
src-tauri/tauri.conf.json

git tag v0.0.2
git push origin v0.0.2

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


# Roadmap
- Add images in the text editor
- Add a search bar on the research topics view, the same way as we have done this already for watchlists
- Add upload functionality for documents to the research topics view the same way, as we have done it already for securities
- Use the same > tree symbol with colored circle also in the taxonomy editor
- Add  company logos (optionally replacing the chart symbol)

- Font sizes are not aligned everywhere which looks not perfect
- Add a stock price chart and mark the journal entries on the chart line
- Add AI chat on the security detail and topic view to summarize, extend and verify the investment thesis
    - Do we need RAG or can the content fit into the context window? Or manual user based attachments?

- Fetch favicon from websites like yf or tikr or whatever the user eenters and use this icon instead of text everywhere in the app
- Search bar for any text editor

- Documents
    - Attach documents to research topics too
    - Link from a note to a particular document
    - Full-text PDF search
    - Extract report text for summarization or AI-assisted research
