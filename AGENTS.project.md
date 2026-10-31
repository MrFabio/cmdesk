# CMdesk — project memory

Read this before changing the product. The sandbox `AGENTS.md` still owns preview, deploy, and shell rules. This file owns **what the app is and how the save is read**.

CMdesk is a static, client-side, **read-only** viewer for Championship Manager 01/02 `.sav` files (patch **3.9.68** record sizes). The file never leaves the browser. Nothing is written back. There are no accounts and no database. Do not add auth, `@/lib/db`, or migrations.

Do not vendor unlicensed CM sources. Do not ship official data, club logos, or present CMdesk as the game. Footer stance: not affiliated with Sports Interactive or Square Enix. Championship Manager remains their trademark.

## Product scope

In: open a local file, fictional sample career, club squad, free agents, player page, search, column sort, saved searches, settings (theme, attribute colours, currency, wage period), club set-piece boards (penalties, free kicks, corners, throw-ins).

Out, until the user asks: editing the save, league tables, tactics, match stats, career-history UI, opening a save from a URL, accounts, uploads.

## Where the logic lives

| Path | Role |
| --- | --- |
| `src/lib/cm/parse.ts` | Container, RLE, records, joins, flags. The dangerous file. |
| `src/lib/cm/binary.ts` | Latin-1 strings, little-endian reads, TCMDate, RLE compressor used by the sample. |
| `src/lib/cm/types.ts` | `ATTRS`, `FLAG` bits, `PlayerRec`, `ParsedSave`. |
| `src/lib/cm/sample.ts` | `buildSample()`. Fictional Albion league. Not a real database. |
| `src/lib/cm/load.ts` | Parse in a module worker; fall back to the main thread on worker *script* failure, not on parse errors. |
| `src/lib/cm/query.ts` | Filters, squad/free lists, sort. Wage and value filters are in **display** units when a view is passed. |
| `src/lib/cm/labels.ts` | Money, wage period, status text, ability bands. |
| `src/lib/cm/settings.ts` | Zustand persist `cmdesk-settings`. On first read, copies `savedesk-settings` across and deletes it. |
| `src/lib/cm/searches.ts` | Zustand persist `cmdesk-searches`. Same one-time rename from `savedesk-searches`. Separate store on purpose. |
| `src/lib/cm/store.ts` | Session desk only. The parsed save is **not** persisted. |
| `src/components/desk/` | UI. Tokens in `src/styles.css`. No ad-hoc hex in JSX. |
| `scripts/build-pages.mjs` | Static GitHub Pages build. |
| `.github/workflows/pages.yml` | Pages deploy. Upload `dist/client` only. |

Tests: `node --experimental-strip-types --test src/lib/cm/parse.test.ts src/lib/cm/query.test.ts`. Parser imports inside `src/lib/cm` use `.ts` extensions so that runner works.

## Save container

Little-endian. ISO-8859-1 strings.

- int32 at 0: `4` compressed, `3` plain. Anything else is not this reader’s file.
- int32 at 4: unknown. **Do not skip it.**
- int32 at 8: block count.
- Then `blockCount` headers of **268** bytes from offset 12. Header: u32 position at 0, u32 uncompressed size at 4, ASCII name at 8.
- Payload starts at `12 + count * 268`.

RLE (compressed blocks only): a byte `<= 128` is a literal, **including 128**. A byte `> 128` repeats the next byte `(mark - 128)` times. A count of 0 still consumes the next byte. Max run 126. Bytes 129–255 are never literals. Refuse a block whose uncompressed size is over 80MB.

`index.dat` records are 67 bytes: name (51), file type, count at +55. Prefer the index count when it fits the block.

## Record sizes (pack = 1, sequential). Do not trust old hex comments.

| Block | Bytes |
| --- | --- |
| TCMDate | 8 (int16 0-based day-of-year, int16 year, int32 leap) |
| staff.dat | 110 |
| player.dat | 70 |
| names | 60 (text in the first 51) |
| club.dat | 581 |
| club_comp.dat | 107 |
| nation.dat | 290 |
| contract.dat | 80 |
| staff_history.dat | 17 |

Required blocks: `staff.dat`, `player.dat`, `club.dat`, `nation.dat`, `first_names.dat`, `second_names.dat`. Also read when present: common names, contract, club_comp, general, staff_history, index. Unreadable nation or club names throw “not the 3.9.68 layout”.

### Staff fields that matter

ID int32 at 0 (this is the id, **not** the loop index). First/second/common name indexes at +4/+8/+12. DOB at +16. Nation at +26, second nation at +30. Caps/goals bytes at +34/+35. ClubJob int32 at +57. Job byte at +61 (`5` manager, `6` assistant, `11` player, `16` retired). DateJoinedClub +62, DateExpiresClub +70. Wage int32 +78, value int32 +82. Hidden personality bytes +86..+93. Player index int32 at +97.

Include anyone whose player index is `>= 0` and in range, with a name. Managers: prefer job 5 over job 6; they appear on the club header only.

### Player fields

Squad number byte +4. CA int16 +5, PA int16 +7. Reputation u16 at +9/+11/+13. Role bytes +15..+21 (GK, then sweeper at +16, then D DM M AM F). Ignore the sweeper byte: this database has no sweepers, and the desk does not show that position. Wing-back +22, side R/L/C at +23/+24/+25. A role counts when the byte is `>= 15`. If no role and wing-back `>= 15`, treat as D/AM. Attribute bytes are mapped in `writeAttrs` (signed). Left foot +48, right foot +59, morale +69. Display `-1` as unknown.

**CA-dependent attrs** (anticipation, crossing, decisions, dribbling, finishing, handling, heading, long shots, marking, movement, one on ones, passing, penalties, positioning, reflexes, tackling, throw ins, vision) are stored as *intrinsics* (often negative or >20). The 1–20 profile value is `displayAttr` in `attr-display.ts` (CM Scout / Uncap20 formula: `ability = CA/2+80`, `v = (2*intrinsic+ability)*0.1`, then per-attr tweaks, round, clamp 1–20). Other attrs are shown as stored.

### Contracts

Preamble: int32 `preCount` at 0, int32 count at 4, records start at `8 + preCount * 21`. If `preCount > 0`, re-read count at `start - 4`. Join `contract.staffId === staff.ID`. Primary contract is the one whose club equals ClubJob, else the first. Squad status and release fee come from the primary contract. Contract wage int32 at **+12** (weekly pounds that club pays). For loaned-in players (`FLAG.loan`), show that primary-contract wage — staff wage is often still the parent club’s deal.

### Flags

`FLAG` in `types.ts`: free 1, loan 2, listed 4, request 8, listLoan 16, bosman 32, arranged 64, unprotected 128, retired 256. The roster column is a `Uint16Array` so retired fits beside the other eight bits.

- Free: ClubJob `< 0`, and the job byte is not retired.
- Retired: job byte `16` (`JOB_PLAYER_RETIRED`). Still loaded (they keep a player index). Not a free agent, even when ClubJob is below 0. Search drops them while `hideRetired` is true, which is the default. That switch does not count as an active filter, so an empty box still waits for a name or another filter. Clear turns it back on. Status pill: `Retired`.
- Listed / request / loan-list: transfer status bits 1 / 8 / 2.
- Bosman: contract LeavingOnBosman `!== 0`.
- Arranged: `TransferArrangedFor >= 0`. Only `< 0` means none.
- Unprotected: (tenure ≥ 3 years, or age at join ≥ 28 and tenure ≥ 2 years) and contract expires within 182 days. Uses **staff** DateJoinedClub / DateExpiresClub.
- Loan: ClubJob contract `contractType` byte at **+53** is `6` or `70` (loan deal), with a second non-loan contract as the parent (`loanFromClubId`). Fallback when `staff_history.dat` exists: history `OnLoan !== 0` for ClubJob in the game year / year before, plus that second contract. Do not treat a second contract alone as a loan (co-ownership / future deals use other types, e.g. 198). Some modern saves only ship `staff history.tmp` (different layout) and omit `staff_history.dat` — type `6` still works. Status: `Loan from {parent}`. Wage is the ClubJob contract wage (loan share; often `0`).

Squad status uses the odd bit tests in `squadStatusLabel` (`& 240 == 0` uncertain, then 224, 208, …). The sample’s status 32 is First team.

### Game date and human club

`general.dat` offset **3944** is a TCMDate. Human short name is a cstring at **0x824**, matched to club short then full name. **Not verified on a real save.** Same for `staff_history.dat` field meaning, and for treating a second contract as a loan parent rather than a future deal.

## Display rules

- CA/PA colour: `round(value / 10)` clamped to 1–20, then the same six bands as attributes (1–4, 5–8, 9–11, 12–14, 15–17, 18–20). Packs are `data-pack` on `<html>` (`classic`, `broadcast`, `ink`, `signal`). Chrome themes are separate: `data-theme`.
- Themes: `broadsheet` (default), `programme`, `floodlight`, `ledger`. Tokens live in `src/styles.css` under `html[data-theme]`. Broadsheet is also the `@theme` default. A head script applies the saved theme before paint.
- The save stores **pounds** and **weekly** wages. Currency and period are display only. Euro uses **£1 = €3.8835**. Month = × **4**, year = × **50** (not calendar 52). Search “wage ≤” and “value ≥” are interpreted in the current currency and wage period, then converted back to weekly pounds.
- Sort is one desk-wide sort, not part of Filters. Default `pos` / asc. Clicking a column flips direction; a new column uses `defaultSortDir` (name/pos/age/nat/club/expires/status asc; ca/pa/wage/value/morale desc). Missing contract dates stay last. If “remember column sort” is on, write through to settings. On hydration, apply the saved sort only if the desk is still pos/asc. If PA is hidden and the sort is PA, show CA desc.
- Saved searches persist separately so Reset settings does not delete them. Defaults in `DEFAULT_SEARCHES` are not stored and cannot be deleted.
- Names: common (default) or full. Density, columns (value and morale off by default), hide goalkeeping for outfielders, mute attributes under 0/8/11/15 (0 = off; does not mute CA/PA).
- Match → Suggested picks a side for the club’s shape, or a 4-4-2 when none decoded. The score is the position-rating fit on in-match attributes, then condition (full from 90% up), morale, and consistency. Recent ratings are not an input to the next match and are not used. Important matches is left out because the save does not say the next game is one. The bench is nine when the squad has them: one goalkeeper, then cover for the lines in the shape, and no second goalkeeper. Injured players are left out of the side and the bench.
- `injury.dat` is one 31-byte fitness row per staff index, then an int32 count and 48-byte injury entries. Condition is the words at +8 and +10, times each other, over 1,000,000. The int32 at +0x0e is the current injury, or below 0 when he is fit. Days still out are the int16 at +0x2c of that entry. Under 7 days reads “a few days”, under 14 “1 week”, under 21 “2 weeks”, then 3 weeks, 1 month, 6 weeks, 2 months, 3 months, 6 months, and over 6 months. Under 14 days is the orange injury. 14 days and more is the red injury. A tag sits on the player; the player page also shows the day count and the return date. Checked on a real career dated 3 Aug 2026: 5 days and 7 days orange, 16 days red.
- On the player page, a marked attribute row uses the position-rating fit. The theme accent is weight at least 0.10. A second colour is weight from 0.05 up to 0.10. Several positions take the stronger mark. Side picks central vs wide. A wide attacking mid uses the wide-mid weights, and every forward uses the central-forward weights. A tactic sweeper circle is rated as a centre-back. Feet are not marked. Finishing (0.024) and One on ones (no weight) stay unmarked. Hidden attributes are not in that fit. The same accent marks Consistency and Important matches for every player. The second colour marks Versatility, Temperament, and Pressure. Dirtiness and Injury proneness stay unmarked because a higher number is worse.
- Club set-piece boards rank the outfield squad by the attribute the game uses: Penalties, Free kicks, Corners, Throw ins. Penalties and throw-ins are ordered by the in-match value, so two profiles of 20 can split, and a second number shows when that value is above 20. Pure goalkeepers are omitted. Feet are shown for free kicks and corners.

## Sample career

`buildSample()`. Nations Albion and Nordmark. Competitions Premier and Second. Clubs Northbridge (human), Redwick, Harbour. Game date 15 Oct 2001. Plain and compressed parses must match (`parse.test.ts`). Do not “fix” filler positions with a negative modulo; JS `%` stays negative.

## GitHub Pages

`npm run build` stays the Vercel/nitro path. `PAGES=1` (`npm run build:pages`) is a separate SPA prerender: `spa.prerender.outputPath` is `"/index"` so the file is `index.html` (not `/_shell.html` or `index.html.html`). The script copies `index.html` to `404.html`, writes `.nojekyll`, writes a static manifest, and rewrites a stylesheet href if the server hash and the client hash disagree. Keep that rewrite.

Workflow: push to `main` or `master`, or run it by hand. Source must be **GitHub Actions**. Project sites use `/<repo>/`. User sites (`*.github.io`) and custom domains need repository variable `PAGES_BASE=/`.

Public site: `https://mrfabio.github.io/cmdesk/` (GitHub user `MrFabio`, repo `cmdesk`, path `/cmdesk/`). Canonical, title, and description live in [src/lib/og/site.json](src/lib/og/site.json). Do not put `og:` or `twitter:` tags in `__root.tsx` — the preview injector owns those, and `scripts/build-pages.mjs` adds them only to the static Pages HTML. `public/robots.txt` and `public/sitemap.xml` point at that URL. Copy must say viewer, not editor: the app does not write the save.

Do not add the Grok branding script by hand. Keep `AuthProvider`, `PreviewHostBridge`, and `getRouter()`.
