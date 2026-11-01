# paperly

**All your PDF tools. One happy place.**

A responsive, installable PDF workspace built with Next.js App Router, React, PostgreSQL, and Drizzle ORM. All PDF processing happens on the user's device. Files are never uploaded or stored by the server.

## The toolbox

20 free tools for:

- **Organizing:** merge, split, rotate, organize pages, remove pages, and extract pages.
- **Converting:** PDF to Word, Word to PDF, JPG/PNG/WebP to PDF, PDF to JPG/PNG, and PDF to plain text.
- **Editing and optimizing:** compress, watermark, page numbers, crop, repair, and flatten.
- **Security:** password protection and unlocking with the current password.

Includes searchable categories, persistent favorites, guest workspace settings, private metadata-only history, built-in sample documents, drag-and-drop file ordering, and downloadable results.

## Run locally

1. Install dependencies with `npm install`.
2. Provide `DATABASE_URL` in `.env` for your PostgreSQL database (see `.env.example`). This is only needed for favorites, workspace name, job history, and feedback; all PDF processing and the rest of the app work without it.
3. Apply the schema using `npx drizzle-kit push`.
4. Run `npm run dev`.

`drizzle.config.ts` reads `DATABASE_URL` from `.env`. All database interactions use the Drizzle client and schema in `src/db`. The client connects lazily, so the app builds and runs even when `DATABASE_URL` is not set; the workspace API then returns a 503 and the client falls back to local storage.

## Deploy to Vercel

1. Push this repository to GitHub and import it in Vercel.
2. In the Vercel dashboard, add a Postgres database from the Marketplace (Neon) to the project. Vercel injects `DATABASE_URL` automatically.
3. Apply the schema to the production database once: `DATABASE_URL="<neon-url>" npx drizzle-kit push`.
4. Deploy. No other environment variables or build settings are required.

Without a database the deploy still succeeds and every PDF tool works; only favorites/history/feedback are disabled (they fall back to browser local storage).

## Production checks

- `npx next typegen`
- `npm exec tsc -- --noEmit --pretty false`
- `npm run build`

For end-to-end checks against a running production app, install the browser with `npx playwright install --with-deps chromium`, then run `node tests/smoke.mjs`. Set `TEST_URL` to test a different host. The suite checks all 20 tools, validates actual downloaded files, and exercises search, favorites, database-backed history, workspace isolation, PWA caching, offline PDF merging, and mobile navigation. Screenshots and test outputs are written to `.artifacts/`.

## Privacy and persistence

The server stores a private guest workspace ID in a first-party HTTP-only cookie, favorites, a workspace name, and recent job metadata (tool, file name, sizes, page count, and timestamp). No document content is stored in PostgreSQL. Feedback is saved only when explicitly submitted.

History is also backed up in local storage for offline resilience and synchronized on reconnect. Local file contents are never persisted in the service worker cache. Use Workspace settings to clear history. Guest workspaces are tied to the browser cookie; this application does not provide cross-device accounts or public file sharing.

## PWA

The app is served with a web manifest, install icons, and a service worker. The initial application shell, self-hosted fonts, and tool assets already used are available offline. Tool-specific PDF.js modules are cached when first used. Install from the browser menu, or use the in-app installation instructions. Service workers require HTTPS or localhost. PDF.js worker, fonts, CMaps, and WASM assets are hosted in `public/pdf-assets/`.

## Honest limitations

- Safety limits: 20 files, 50 MB per file, 150 MB per task, and 500 PDF pages.
- Word conversion produces editable text-based DOCX; complex PDF layouts may need reformatting. Scanned pages need OCR, which is not included.
- DOCX-to-PDF preserves basic headings, paragraphs, lists, and supported images. Advanced Word layouts are simplified.
- Compression, flattening, and unlocking render pages as images. Selectable text, annotations, form behavior, and links are not retained in those output copies. The original is kept if compression would enlarge the file.
- Repair rebuilds recoverable PDF structure; it cannot recover missing data.
- Protection uses 128-bit RC4 compatibility encryption, not modern AES. Passwords are never stored. Unlocking requires the correct existing password; advanced encryption may need a desktop PDF reader. Only process documents you have permission to edit.
- Keep originals and review generated documents. Local processing performance depends on the browser and available memory.

The public application does not require a login, paid subscription, external PDF API, or secret keys for PDF processing. PDF engine downloads and fonts are self-hosted.
