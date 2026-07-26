# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repo hosts internal tools for the Dobelmühle organization. Currently it contains one app:
**Kassensystem** (`kassensystem/`), an offline point-of-sale system used on a laptop wired to a
USB/serial ESC/POS receipt printer at festival/event food & drink stands. All user-facing text,
UI, commit-adjacent docs, and error messages in this app are in **German** — match that when
editing strings the till operator sees.

There is no top-level build — all commands below are run from inside `kassensystem/`.

## Commands

```bash
cd kassensystem
npm install

npm run dev          # Electron app with hot reload (dev mode)
npm run typecheck    # tsc --noEmit, both the main/preload and web tsconfig projects
npm test             # vitest run — all tests
npm test -- cart      # run a single test file/pattern (vitest filters by filename/-t)
npm run build         # typecheck + electron-vite build (used by dist:* targets)
npm run dist:win      # build + electron-builder Windows NSIS installer (must run on real Windows)
npm run dist:linux    # build + electron-builder Linux AppImage
```

There's no separate lint script — `typecheck` is the gate. `npm test` runs Vitest once (no watch).

### Native modules: two different Node ABIs

`better-sqlite3`, `usb`, and `serialport` are native addons. `npm run dev`/`start`/`dist:*` run
inside **Electron's** bundled Node; `npm test` runs in **your system** Node — different ABI
versions. That's why `predev`/`prestart`/`predist:*` run `electron-rebuild` and `pretest` runs
`npm rebuild` — both fire automatically as npm pre-hooks, so just use the scripts above directly
rather than calling the underlying tools. Switching between `npm run dev` and `npm test`
back-to-back costs a rebuild each time; if you see `NODE_MODULE_VERSION ... requires` or `Module
did not self-register`, the ABI is mismatched — rerun the relevant npm script (don't hand-fix it).

### Tests run outside Electron

Vitest aliases `electron` to `src/main/__tests__/electron.mock.ts` (see `vitest.config.ts`) —
tests never touch the real Electron runtime. `initDb(':memory:')` (an explicit path argument)
avoids the only call that would otherwise hit `app.getPath`. When adding main-process code that
needs Electron APIs beyond `app.getPath`, extend the mock rather than assuming Electron is
present in tests.

## Architecture

Standard `electron-vite` three-process layout, wired together by a single typed IPC contract:

```
src/main/       Electron main process — Node, SQLite, USB/serial hardware access
src/preload/    contextBridge shim exposing window.kassen (the KassenApi) to the renderer
src/renderer/   React UI (no Node access — everything goes through window.kassen)
src/shared/     Pure, framework-free logic + types used by BOTH main and renderer/tests
```

**`src/shared/types.ts`** is the contract: it defines every domain type (`Product`, `SaleRecord`,
`Settings`, …) plus the `KassenApi` interface. `src/preload/index.ts` implements `KassenApi` by
forwarding each method to `ipcRenderer.invoke(<channel>)`; `src/main/ipc.ts` registers the
matching `ipcMain.handle(<channel>, ...)` for each one, delegating to the relevant `src/main/*.ts`
module. When adding a new operation: add it to `KassenApi` in `shared/types.ts`, wire it in both
`preload/index.ts` and `main/ipc.ts` with the same channel string, then implement it in the
appropriate `main/*.ts` module.

**`src/main/` modules**, each owning one concern against the single SQLite DB (`db.ts`):
- `db.ts` — schema (`CREATE TABLE IF NOT EXISTS`), append-only `migrate()` for existing installs,
  default settings/sample product seeding, and the shared receipt/voucher number counters.
- `products.ts`, `sales.ts`, `settings.ts`, `journal.ts` — CRUD and business logic per domain.
- `printer.ts` — talks ESC/POS directly to the receipt printer, bypassing the OS print spooler,
  over one of three transports (`UsbEscposInterface` via the `usb` package, `SerialEscposInterface`
  via `serialport`, or `DryRunInterface` which just logs — used whenever no printer is configured,
  so the app is fully usable without hardware). Also owns serial baud-rate auto-detection
  (silent status-query probe, falling back to printed test slips) and printer-width/formatting
  quirks accumulated from real hardware testing (see inline comments — e.g. the hardcoded
  44-column width, ASCII "EUR" instead of "€", word-boundary-only wrapping).
- `backup.ts` — post-sale automatic snapshots (keeps last 5) plus manual export/restore of the
  whole SQLite file.
- `export.ts` — CSV/Excel/PDF exports of full sales history (uses `exceljs`; distinct from the
  aggregated, date-ranged `journal.ts` till report).

**`src/shared/`** (imported by both main and renderer, and directly unit-tested):
- `cart.ts` — `expandCart()` turns raw `{productId, quantity}` lines into full cart lines,
  auto-inserting a Pfand (deposit) line after any product with `depositCents > 0`; also
  `cartTotalCents`, `changeCents`, and `taxBreakdown()` (gross→net/tax back-calculation per German
  VAT class A/B).
- `serialProbe.ts` — baud-rate candidates and the ESC/POS status-query bytes/response heuristic
  used by both the silent probe and the printer module.

Money is always integer **cents** end-to-end (`priceCents`, `totalCents`, …) — never floats.

**Renderer** (`src/renderer/src/`): a small hand-rolled page switch in `App.tsx` (no router) between
`pages/Kasse.tsx` (till/checkout), `pages/Produkte.tsx` (product management), `pages/Tagesuebersicht.tsx`
(journal/day report), `pages/Einstellungen.tsx` (settings incl. printer setup). All data access
goes through `window.kassen.*` (typed via `KassenApi`), never direct IPC calls.

### Key domain flows worth understanding before changing them

- **Pfand (deposit) auto-add**: configured per-product as `depositCents`; `expandCart()` is the
  single place that turns one clicked product into (product line + optional deposit line). Both
  the checkout preview and the authoritative sale creation call through this same function.
- **Wertbon-before-confirm printing**: clicking "Kassieren" (open checkout) immediately prints one
  voucher per cart item via `printVoucherPreview`/`expandCartForPreview`, *before* the sale is
  saved or a real voucher number exists (`fillVoucher` omits the number line in that case). The
  combined Kassenbon is a separate, explicit action after confirming — see `printSale`'s
  `printReceipt`/`printVouchers` options, both default `false`.
  Voucher numbers themselves are a single global, contiguous counter (`nextVoucherNumbers` in
  `db.ts`), assigned only at actual `createSale()` time — not during the pre-confirm preview.
  Multiple cash registers each keep independent local counters, disambiguated by a per-register
  `registerNumber` printed on every receipt/voucher.
- **Void ("Stornieren")**: only the most recent sale can be voided (`voidSale` sets a `voided`
  flag; already-printed paper is untouched, but the sale drops out of the journal).
- **DB migrations**: `db.ts`'s `CREATE TABLE IF NOT EXISTS` never alters existing tables, so any
  new column needs an explicit, append-only `ALTER TABLE` in `migrate()` — this runs against real
  festival data on deployed till laptops, so never rewrite history there, only add.

## CI/CD

- `.github/workflows/build-windows-installer.yml` / `build-linux-mac-installer.yml` — manual
  (`workflow_dispatch`) ad-hoc installer builds for quick testing without owning the target OS.
- `.github/workflows/release.yml` — builds Windows + Linux installers and publishes them to a
  GitHub Release, triggered by pushing a `vX.Y.Z` tag (bump `version` in `kassensystem/package.json`
  first). `workflow_dispatch` on this workflow test-builds both but does not publish a release.

Windows/macOS builds can't be cross-compiled from Linux (native modules must compile for the
target OS) — that's why these workflows exist rather than just running `dist:*` locally.
