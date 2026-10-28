import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { Moderation } from './Moderation';

vi.mock('../auth/supabase', () => ({
  authConfigured: true,
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'mod-token' } } }),
    },
  },
}));

afterEach(() => vi.restoreAllMocks());

const as = (role: 'user' | 'moderator' | 'admin'): AuthState => ({
  status: 'signedIn',
  user: { id: 'u', email: null, username: 'm', role },
  configured: true,
  signOut: async () => {},
});

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );

const report = (id: string, targetStatus: 'published' | 'hidden' | 'removed') => ({
  id,
  targetType: 'interpretation',
  targetId: `target-${id}`,
  reason: 'spam',
  details: null,
  status: 'actioned',
  createdAt: '2026-01-01T00:00:00Z',
  resolvedAt: '2026-01-02T00:00:00Z',
  reporter: { username: 'reporter' },
  target: {
    status: targetStatus,
    authorUsername: 'author',
    interpretationId: `target-${id}`,
    excerpt: `Excerpt ${id}`,
  },
});

const page = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 20 });

function renderPage(auth: AuthState) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={auth}>
        <Moderation />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('Moderation page', () => {
  it('blocks ordinary users without calling the API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(page([])));
    renderPage(as('user'));
    expect(await screen.findByText('Moderators only')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the login token when loading the queue (the queue API is not public)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(page([])));
    renderPage(as('moderator'));
    await screen.findByText('No open reports');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/api/moderation/reports?status=open');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer mod-token');
  });

  it('shows an empty Open tab, then a Handled tab with restore only for hidden/removed content', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((u) =>
        String(u).includes('status=actioned')
          ? json(page([report('a', 'hidden'), report('b', 'published'), report('c', 'removed')]))
          : json(page([])),
      );
    renderPage(as('moderator'));
    expect(await screen.findByText('No open reports')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Handled' }));
    expect(await screen.findByText('Excerpt a')).toBeInTheDocument();
    expect(String(fetchMock.mock.calls.at(-1)![0])).toContain('status=actioned');
    // Two restorable items; the already-published one offers no restore and links to the page.
    expect(screen.getAllByRole('button', { name: 'Restore content' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Open in context' })).toHaveLength(1);
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
  });

  it('restores with an authenticated POST including the note, then reloads', async () => {
    let restored = false;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((u, init) => {
      if (init?.method === 'POST') {
        restored = true;
        return json({ restored: true });
      }
      return String(u).includes('status=actioned')
        ? json(page([report('a', restored ? 'published' : 'hidden')]))
        : json(page([]));
    });
    renderPage(as('admin'));
    await userEvent.click(await screen.findByRole('button', { name: 'Handled' }));
    await userEvent.type(await screen.findByLabelText(/note/i), 'appeal upheld');
    await userEvent.click(screen.getByRole('button', { name: 'Restore content' }));

    const post = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')!;
    expect(String(post[0])).toContain('/api/moderation/content/interpretation/target-a/restore');
    expect((post[1]!.headers as Record<string, string>).Authorization).toBe('Bearer mod-token');
    expect(JSON.parse(String(post[1]!.body))).toEqual({ note: 'appeal upheld' });
    // After reload the item is published, so the restore button is gone.
    expect(await screen.findByRole('link', { name: 'Open in context' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore content' })).toBeNull();
  });

  it('shows the server message when a restore is refused', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((u, init) =>
      init?.method === 'POST'
        ? json({ error: { code: 'not_restorable', message: 'Not restorable here.' } }, 409)
        : String(u).includes('status=actioned')
          ? json(page([report('a', 'removed')]))
          : json(page([])),
    );
    renderPage(as('moderator'));
    await userEvent.click(await screen.findByRole('button', { name: 'Handled' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Restore content' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not restorable here.');
  });
});
