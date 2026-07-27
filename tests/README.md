# E2E test suite

Playwright tests for `trips-app.html`. Goals: cheap and fast for everyday use,
thorough when you ask for the full run, and hermetic (no real network calls,
no touching the real Supabase project) so it can't corrupt production data or
flake on a slow connection.

## Running

```
npm test          # chromium only — the everyday loop, ~2-3 min
npm run test:full # chromium + firefox + webkit — full coverage, on request
npm run test:ui    # Playwright's interactive UI mode
npm run test:headed
npm run test:debug
npm run report     # open the last HTML report
```

CI (`.github/workflows/e2e.yml`) runs `test:full` on every push/PR to `main`
and uploads the HTML report as an artifact on failure.

## How it stays hermetic

- **`localPage` fixture** (`fixtures.ts`): serves `trips-app.html` with the
  `SUPABASE_URL` constant patched (only in the HTTP response, never on disk)
  to a `YOUR_`-prefixed placeholder. That flips the app's own
  `SUPABASE_CONFIGURED` flag to false, which is a real, already-existing code
  path (`startup()` skips auth entirely and calls `init()` directly). Use
  this for anything that isn't specifically about auth or cloud sync — it's
  fully offline and the default for most spec files.
- **`mockPage` / `authedPage` fixtures**: use the app's real Supabase config,
  but every `auth/v1` and `rest/v1` request is served by an in-memory fake
  backend (`helpers/fakeSupabaseBackend.ts`) instead of the real project.
  `authedPage` additionally pre-seeds a valid session so tests can skip the
  login form when they just need *some* authenticated session (e.g. to reach
  the settings dropdown, which only renders once signed in).
- The Supabase JS CDN script and the Anthropic API call (used for AI to-do
  suggestions) are both stubbed too — `tests/vendor/supabase-js.umd.js` is a
  pinned local copy of the real library, so nothing in the suite depends on
  network access at all once `npm install` has run.

`helpers/fakeSupabaseBackend.ts`'s `FakeSupabase` class is intentionally not
a spec-complete Postgrest/GoTrue emulator — just enough surface for the auth
and sync code paths this app actually exercises. Extend it if a new sync call
needs more realistic behavior; don't reach for a real Supabase project.

## Structure

- `fixtures.ts` — the three page fixtures above, plus `fakeSupabase`.
- `helpers/actions.ts` — shared locators/actions (`itemRow`, `section`,
  `createTrip`, `addItemInSection`, `open*Menu`) used across spec files so
  selectors live in one place.
- `*.spec.ts` — one file per feature area (trips, pack-list, todo-list,
  containers, pending, suggestions, context-menu-keyboard, profile-menu,
  auth, persistence).

Most spec files' `beforeEach` creates a brand-new trip via the UI rather than
using the "salem"/"birthday" demo trips. New trips always start with the same
small, known set of starter items (see `packStarter`/`todoStarter` in
`createTrip()`), so tests don't churn every time someone edits the demo trip
content — only genuine behavior changes should break them.

## `BUG:`-prefixed tests

A couple of tests are prefixed `BUG:` and document real, currently-shipping
app behavior that looks unintentional, found while writing this suite:

- `trips.spec.ts` — creating a trip doesn't persist it as the "last trip",
  so reloading right after creating one silently drops you back onto
  whatever trip was last explicitly selected.
- `auth.spec.ts` — signing into an existing account on a browser that's
  never run the app before overwrites that account's real cloud item
  library with the hardcoded defaults (and re-syncs that clobber back up to
  Supabase).

These aren't flaky tests — they pass because they assert the *current* (bad)
behavior. If either bug gets fixed, update the assertion (each has a comment
marking what should change) rather than deleting the test.

## Extending

Add new tests to the existing file for that feature area, or a new file
following the same pattern (`import { test, expect } from './fixtures'`, a
`beforeEach` that creates a fresh trip, helpers from `helpers/actions.ts`).
Prefer `localPage` unless the thing under test is genuinely auth/sync-
specific — it's faster and there's less to reason about.
