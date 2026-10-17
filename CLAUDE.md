# packing_list — notes for future sessions

Read the shared conventions first: `CHANGELOG.md`, then `best-practices.md`,
`css-best-practices.md` and `testing-guidelines.md`. They live in the
`apps-shared` repo — `../apps-shared/` here, `/home/alex/apps/shared/` on the
Ubuntu box, otherwise `github.com/alexkrewson/apps-shared`. Say "sync shared"
to have them re-applied to this project.

## Stack

Single-file app: `trips-app.html`, vanilla JS, Supabase via the UMD bundle.
No build step. `npm install` exists only for the Playwright tests.

Live at https://trip.trolleysolution.com: GitHub Pages, deployed by
`.github/workflows/deploy.yml` on every push to `main` (it copies the file to
`index.html` and writes the CNAME). DNS is a DNS-only `trip` CNAME in
Cloudflare. The old `alexkrewson.github.io/packing_list/` redirects there.

Tables are still `public.master_items` / `public.master_cats` — moving them to
a `packing_lists.*` schema is an open item in `apps-shared/todo.md`. Auth is
shared with every other app in that Supabase project.

## Commands

```bash
npm test · npm run test:ui · npm run test:headed · npm run report
```

`playwright.config.ts` serves the app with `tests/helpers/static-server.mjs`
(plain Node, no dependency) so the suite runs the same on Windows and Linux.
Don't switch it back to `python3 -m http.server`: on Windows `python3` is a
Microsoft Store stub.
