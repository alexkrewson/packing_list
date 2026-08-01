# packing_list — notes for future sessions

Read the shared conventions first: `CHANGELOG.md`, then `best-practices.md`,
`css-best-practices.md` and `testing-guidelines.md`. They live in the
`apps-shared` repo — `../apps-shared/` here, `/home/alex/apps/shared/` on the
Ubuntu box, otherwise `github.com/alexkrewson/apps-shared`. Say "sync shared"
to have them re-applied to this project.

## Stack

Single-file app: `trips-app.html`, vanilla JS, Supabase via the UMD bundle.
No build step. `npm install` exists only for the Playwright tests.

Tables are still `public.master_items` / `public.master_cats` — moving them to
a `packing_lists.*` schema is an open item in `apps-shared/todo.md`. Auth is
shared with every other app in that Supabase project.

## Commands

```bash
npm test · npm run test:ui · npm run test:headed · npm run report
```

**`playwright.config.ts` serves the app with `python3 -m http.server`, which
does not work on Windows** — `python3` there is a 0-byte Microsoft Store stub,
so it opens the Store instead of serving. Real Python installs `python.exe`
only. Needs a cross-platform fix before the suite runs off Linux.
