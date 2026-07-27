import type { Page, Route } from '@playwright/test';

// Must match the SUPABASE_URL const in trips-app.html — the app's Supabase
// project host. Tests never actually reach this host (all auth/v1 and
// rest/v1 traffic is intercepted), but supabase-js derives its localStorage
// key from the hostname, so the fake session below has to agree with it.
export const SUPABASE_URL = 'https://ycuuxnscbxiibsnefgef.supabase.co';

export interface FakeUser {
  id: string;
  email: string;
  password: string;
}

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

/** supabase-js persists exactly this shape (JSON-stringified) under `sb-<project-ref>-auth-token`. */
export function makeSession(user: FakeUser) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: user.id, email: user.email, role: 'authenticated', exp: now + 3600, iat: now };
  const access_token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.fake-signature`;
  return {
    access_token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `fake-refresh-${user.id}`,
    user: { id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', created_at: new Date().toISOString() },
  };
}

/**
 * Minimal in-memory stand-in for a Supabase project: just enough of GoTrue
 * (auth/v1) and PostgREST (rest/v1) to exercise trips-app.html's auth + sync
 * code paths without a real backend. It is deliberately not a spec-complete
 * Postgrest emulator (no real filtering beyond `eq.`, no RLS) — extend the
 * relevant handler below if a new sync call needs more realistic behavior.
 */
export class FakeSupabase {
  users: FakeUser[] = [];
  tables: Record<string, any[]> = {
    master_items: [],
    master_cats: [],
    master_containers: [],
    trips: [],
    trip_state: [],
    user_meta: [],
  };
  requireEmailConfirmation = false;

  seedUser(email: string, password: string): FakeUser {
    const user = { id: `user-${this.users.length + 1}`, email, password };
    this.users.push(user);
    return user;
  }

  async install(page: Page) {
    await page.route('**/auth/v1/**', (route) => this.handleAuth(route));
    await page.route('**/rest/v1/**', (route) => this.handleRest(route));
  }

  private postBody(route: Route): any {
    const req = route.request();
    const raw = req.postData();
    return raw ? JSON.parse(raw) : {};
  }

  private async handleAuth(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const body = this.postBody(route);

    if (url.pathname.endsWith('/token') && method === 'POST') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const user = this.users.find((u) => u.email === body.email && u.password === body.password);
        if (!user) {
          return route.fulfill({
            status: 400,
            json: { error: 'invalid_grant', error_description: 'Invalid login credentials' },
          });
        }
        return route.fulfill({ status: 200, json: makeSession(user) });
      }
      if (grant === 'refresh_token') {
        const user = this.users[0];
        if (!user) return route.fulfill({ status: 400, json: { error: 'invalid_grant' } });
        return route.fulfill({ status: 200, json: makeSession(user) });
      }
      return route.fulfill({ status: 400, json: { error: 'unsupported_grant_type' } });
    }

    if (url.pathname.endsWith('/signup') && method === 'POST') {
      if (this.users.some((u) => u.email === body.email)) {
        return route.fulfill({ status: 422, json: { error: 'user_already_exists', msg: 'User already registered' } });
      }
      const user = this.seedUser(body.email, body.password);
      if (this.requireEmailConfirmation) {
        return route.fulfill({
          status: 200,
          json: { id: user.id, email: user.email, confirmation_sent_at: new Date().toISOString() },
        });
      }
      return route.fulfill({ status: 200, json: makeSession(user) });
    }

    if (url.pathname.endsWith('/logout')) {
      return route.fulfill({ status: 204, body: '' });
    }

    if (url.pathname.endsWith('/recover') && method === 'POST') {
      return route.fulfill({ status: 200, json: {} });
    }

    if (url.pathname.endsWith('/user') && method === 'PUT') {
      const user = this.users[0];
      if (user && body.password) user.password = body.password;
      return route.fulfill({ status: 200, json: { user: { id: user?.id, email: user?.email } } });
    }

    if (url.pathname.endsWith('/user') && method === 'GET') {
      const user = this.users[0];
      return route.fulfill({ status: 200, json: { id: user?.id, email: user?.email } });
    }

    return route.fulfill({ status: 404, json: { error: 'not_found' } });
  }

  private async handleRest(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const table = url.pathname.split('/').pop()!;
    if (!(table in this.tables)) this.tables[table] = [];
    const rows = this.tables[table];

    const eqFilters: [string, string][] = [];
    url.searchParams.forEach((value, key) => {
      if (value.startsWith('eq.')) eqFilters.push([key, value.slice(3)]);
    });
    const matches = (row: any) => eqFilters.every(([k, v]) => String(row[k]) === v);

    if (method === 'GET') {
      const result = rows.filter(matches);
      const wantsSingle = (req.headers()['accept'] || '').includes('vnd.pgrst.object+json');
      if (wantsSingle) return route.fulfill({ status: 200, json: result[0] ?? null });
      return route.fulfill({ status: 200, json: result });
    }

    if (method === 'POST') {
      const body = this.postBody(route);
      const incoming = Array.isArray(body) ? body : [body];
      incoming.forEach((row) => {
        const idx = rows.findIndex((r) => r.id === row.id && (row.user_id == null || r.user_id === row.user_id));
        if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
        else rows.push(row);
      });
      return route.fulfill({ status: 201, json: incoming });
    }

    if (method === 'DELETE') {
      this.tables[table] = rows.filter((r) => !matches(r));
      return route.fulfill({ status: 200, json: [] });
    }

    if (method === 'PATCH') {
      const body = this.postBody(route);
      rows.filter(matches).forEach((r) => Object.assign(r, body));
      return route.fulfill({ status: 200, json: rows.filter(matches) });
    }

    return route.fulfill({ status: 404, json: { error: 'not_found' } });
  }
}
