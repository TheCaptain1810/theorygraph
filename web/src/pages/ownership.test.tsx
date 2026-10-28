import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { EditInterpretation } from './EditInterpretation';
import { InterpretationDetail } from './InterpretationDetail';

vi.mock('../auth/supabase', () => ({
  authConfigured: true,
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'test-token' } } }),
    },
  },
}));

afterEach(() => vi.restoreAllMocks());

const as = (username: string): AuthState => ({
  status: 'signedIn',
  user: { id: username, email: null, username, role: 'user' },
  configured: true,
  signOut: async () => {},
});

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );

const interpretation = {
  concealed: false,
  id: 'i1',
  filmId: 'f1',
  author: { username: 'owner', displayName: null },
  title: 'Original title',
  claim: 'Original claim',
  interpretationType: 'interpretation',
  spoilerLevel: 'none',
  tags: [],
  evidence: [],
  counterReadings: [
    {
      id: 'c1',
      author: { username: 'replier', displayName: null },
      body: 'A counter body',
      evidence: [],
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function renderDetail(auth: AuthState) {
  return render(
    <MemoryRouter initialEntries={['/interpretations/i1']}>
      <AuthContext.Provider value={auth}>
        <Routes>
          <Route path="/interpretations/:interpretationId" element={<InterpretationDetail />} />
          <Route path="/films/:filmId" element={<p>Film page</p>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('owner controls on the interpretation page', () => {
  it('shows Edit/Delete to the author and no Report on their own content', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ interpretation }));
    renderDetail(as('owner'));
    expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/interpretations/i1/edit',
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    // Report remains available for someone else's counter-reading, but not for own interpretation.
    expect(screen.getAllByRole('button', { name: 'Report' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /delete my counter-reading/i })).toBeNull();
  });

  it('shows Report (not Edit/Delete) to other users, and Delete only on their own counter-reading', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ interpretation }));
    renderDetail(as('replier'));
    await screen.findByText('A counter body');
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete my counter-reading/i })).toBeInTheDocument();
  });

  it('shows no owner controls when signed out', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ interpretation }));
    renderDetail({ status: 'signedOut', user: null, configured: true, signOut: async () => {} });
    await screen.findByText('A counter body');
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete|report/i })).toBeNull();
  });

  it('needs a second, deliberate click to delete, then sends an authenticated DELETE', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_u, init) =>
        init?.method === 'DELETE'
          ? Promise.resolve(new Response(null, { status: 204 }))
          : json({ interpretation }),
      );
    renderDetail(as('owner'));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: /yes, delete it/i }));
    expect(await screen.findByText('Film page')).toBeInTheDocument();
    const del = fetchMock.mock.calls.find(([, i]) => i?.method === 'DELETE')!;
    expect(String(del[0])).toContain('/api/interpretations/i1');
    expect((del[1]!.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('surfaces a server refusal and leaves the page in place', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_u, init) =>
      init?.method === 'DELETE'
        ? json({ error: { code: 'forbidden', message: 'Not yours' } }, 403)
        : json({ interpretation }),
    );
    renderDetail(as('owner'));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: /yes, delete it/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not yours');
    expect(screen.getByText('Original title')).toBeInTheDocument();
  });
});

describe('edit page', () => {
  function renderEdit(auth: AuthState) {
    return render(
      <MemoryRouter initialEntries={['/interpretations/i1/edit']}>
        <AuthContext.Provider value={auth}>
          <Routes>
            <Route
              path="/interpretations/:interpretationId/edit"
              element={<EditInterpretation />}
            />
            <Route path="/interpretations/:interpretationId" element={<p>Detail page</p>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
  }

  it('blocks anyone but the author', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ interpretation }));
    renderEdit(as('someone_else'));
    expect(
      await screen.findByText('You can only edit your own interpretations'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).toBeNull();
  });

  it('asks for the full text and PATCHes only what changed', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_u, init) =>
        init?.method === 'PATCH' ? json({ interpretation }) : json({ interpretation }),
      );
    renderEdit(as('owner'));
    const title = await screen.findByLabelText('Title');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('reveal=true');
    expect(title).toHaveValue('Original title');

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('Nothing has changed yet.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(false);

    await userEvent.clear(title);
    await userEvent.type(title, 'New title');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('Detail page')).toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, i]) => i?.method === 'PATCH')!;
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ title: 'New title' });
  });

  it('appends added evidence without discarding unsaved edits', async () => {
    const created = {
      id: 'e1',
      evidenceType: 'observation',
      description: 'New observation',
      sceneDescription: null,
      timestampSeconds: null,
      sourceUrl: null,
      createdAt: '2026-01-01T00:00:00Z',
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((u, init) =>
      init?.method === 'POST' && String(u).endsWith('/evidence')
        ? json({ evidence: created }, 201)
        : json({ interpretation }),
    );
    renderEdit(as('owner'));
    const title = await screen.findByLabelText('Title');
    await userEvent.type(title, ' (draft)');
    await userEvent.type(screen.getByLabelText('What do you point to?'), 'New observation');
    await userEvent.click(screen.getByRole('button', { name: 'Add evidence' }));
    expect(await screen.findByText('Added 1 piece of evidence.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Evidence (1)')).toBeInTheDocument());
    expect(screen.getByLabelText('Title')).toHaveValue('Original title (draft)');
  });
});
