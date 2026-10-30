# CMdesk

Online Championship Manager 01/02 save viewer. The public site is [https://mrfabio.github.io/cmdesk/](https://mrfabio.github.io/cmdesk/) — GitHub user `MrFabio`, repository `cmdesk`. GitHub serves that host in lowercase.

Open a `.sav` from your computer, or load the built-in sample, and read the squad the way a scout would: position, age, ability, potential, wage, contract, and whether a player is free, listed, on loan, asking for a transfer, or unprotected.

The file stays in the browser. Nothing is uploaded and nothing is written back. CMdesk is not a save editor.

CMdesk is not affiliated with Sports Interactive or Square Enix. It is not the game, and it does not include the official database.

## What you can do

- Open a local `.sav`, or **Load the sample career** (a fictional Albion league, so the desk works before you have a real file).
- Walk a club’s squad, the free agents, or a search.
- Sort by clicking a column. The sort is remembered in this browser.
- Save a search. A few useful ones are already there: free agents, Bosman, unprotected, expiring, listed, requests, on loan, and youth with high potential.
- Open a player for attributes, contract, and status.
- Change the theme, attribute colours, currency, and whether wages are weekly, monthly, or yearly. Settings live in this browser only.

The reader expects the **3.9.68** save layout. A patched save that resizes records will fail with a clear error rather than show scrambled names.

## Money

The file stores pounds, and wages are weekly. Pounds are the default on screen; other currencies (including euro at £1 = €3.8835) are optional in Settings. A month is 4 weeks. A year is 50 weeks. Search filters follow whatever you picked.

## Themes

Settings → Theme. **Broadsheet** is the default (paper, black ink, a red rule). The others are Programme, Floodlight, and Ledger. Attribute colours are a separate choice and do not change the chrome.

## Run it

```bash
npm install
npm run dev
```

The dev server listens on port 8080.

```bash
npm run typecheck
node --experimental-strip-types --test src/lib/cm/parse.test.ts src/lib/cm/query.test.ts
```

`npm run build` is the server build used for Vercel. It does not produce the GitHub Pages site.

## GitHub Pages

The published address is `https://mrfabio.github.io/cmdesk/`. A project site is served from `/<repo>/`, so the repository name `cmdesk` means the public path is `/cmdesk/`. The workflow sets that from the repository name. User sites (`*.github.io`) and custom domains need the repository variable `PAGES_BASE=/`.

After the first publish, add the site in Google Search Console and submit `https://mrfabio.github.io/cmdesk/sitemap.xml`. The page title, description, and visible text say it is a CM 01/02 save viewer and not a save editor, so those searches can match it without claiming an editor that does not exist.

```bash
# this repository
PAGES_BASE=/cmdesk/ npm run build:pages

# user site (*.github.io) or a custom domain
PAGES_BASE=/ npm run build:pages
```

Output is `dist/client` (`index.html`, `404.html`, `.nojekyll`). Pushing to `main` or `master` runs [`.github/workflows/pages.yml`](.github/workflows/pages.yml). In the repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

A normal project site is `https://<user>.github.io/<repo>/`. If the repository is named `<user>.github.io`, or you attach a custom domain, set the repository variable `PAGES_BASE` to `/` before the first publish.

## How a save is read

The `.sav` is a directory of named blocks. Compressed saves (marker 4) use a small run-length encoding; plain saves (marker 3) store the blocks as-is. Players are staff rows that point at a player record. Contracts, history, nations, and clubs are joined in the browser.

Technical notes for anyone changing the reader, including the record sizes and the rules for loans and Bosman players, are in [`AGENTS.project.md`](AGENTS.project.md). A few offsets (the game date, the human club’s short name, and which contract means “on loan from”) are the usual 3.9.68 places but have not been checked against a real career. If a real save disagrees, that file is where to record the correction.

## What this is not

No editor. No league tables, tactics, or match stats. No account. The sample is fiction, for layout and for the screenshots, not a copy of the 01/02 database.
