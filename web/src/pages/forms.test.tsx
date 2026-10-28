import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { safeNext } from '../auth/RequireAuth';
import { CounterReadingForm } from '../components/CounterReadingForm';
import {
  newEvidenceRow,
  parseTimestamp,
  toPayload,
  validateRows,
} from '../components/evidenceForm';
import { ReportButton } from '../components/ReportButton';
import { NewInterpretation, parseTags } from './NewInterpretation';

// A signed-in Supabase session, so authenticated API calls attach a bearer token.
vi.mock('../auth/supabase', () => ({
  authConfigured: true,
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'test-token' } } }),
    },
  },
}));

afterEach(() => vi.restoreAllMocks());

const signedIn: AuthState = {
  status: 'signedIn',
  user: { id: 'u1', email: 'a@b.c', username: 'tester', role: 'user' },
  configured: true,
  signOut: async () => {},
};
const signedOut: AuthState = { ...signedIn, status: 'signedOut', user: null };

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );

describe('parseTimestamp', () => {
  it('parses seconds, m:ss and h:mm:ss', () => {
    expect(parseTimestamp('75')).toBe(75);
    expect(parseTimestamp('1:15')).toBe(75);
    expect(parseTimestamp('1:02:05')).toBe(3725);
    expect(parseTimestamp('  ')).toBeNull();
  });
  it('rejects negative and malformed values', () => {
    for (const bad of ['-5', '1:75', 'abc', '1:2:3:4', '1.5']) {
      expect(parseTimestamp(bad)).toBeNaN();
    }
  });
});

describe('evidence rows', () => {
  it('builds the API payload, omitting empty optionals', () => {
    const row = {
      ...newEvidenceRow('observation'),
      description: '  A symmetrical frame ',
      timestamp: '1:15',
    };
    expect(toPayload([row])).toEqual([
      { evidenceType: 'observation', description: 'A symmetrical frame', timestampSeconds: 75 },
    ]);
  });
  it('mirrors server rules: description, timestamp and external-source link', () => {
    const rows = [
      { ...newEvidenceRow('observation'), timestamp: '-1' },
      newEvidenceRow('external_source'),
    ];
    const errors = validateRows(rows);
    expect(errors['evidence.0.description']).toBeTruthy();
    expect(errors['evidence.0.timestampSeconds']).toBeTruthy();
    expect(errors['evidence.1.sourceUrl']).toBeTruthy();
  });
});

describe('helpers', () => {
  it('safeNext only allows same-site relative paths', () => {
    expect(safeNext('/films/abc?x=1')).toBe('/films/abc?x=1');
    expect(safeNext('//evil.example')).toBe('/films');
    expect(safeNext('https://evil.example')).toBe('/films');
    expect(safeNext(null)).toBe('/films');
  });
  it('parseTags trims, lowercases and de-duplicates', () => {
    expect(parseTags(' Motif, color ,motif,, ')).toEqual(['motif', 'color']);
  });
});

describe('signed-out gating', () => {
  it('shows a sign-in prompt instead of the counter-reading form', () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={signedOut}>
          <CounterReadingForm interpretationId="i1" onCreated={() => {}} />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('hides the report control', () => {
    render(
      <AuthContext.Provider value={signedOut}>
        <ReportButton targetType="interpretation" targetId="i1" />
      </AuthContext.Provider>,
    );
    expect(screen.queryByRole('button', { name: /report/i })).not.toBeInTheDocument();
  });
});

describe('authoring form', () => {
  const film = { id: 'film1', title: 'Test Film', releaseYear: 1999, director: null };

  function renderForm() {
    return render(
      <MemoryRouter initialEntries={['/new/interpretation?filmId=film1']}>
        <AuthContext.Provider value={signedIn}>
          <Routes>
            <Route path="/new/interpretation" element={<NewInterpretation />} />
            <Route path="/interpretations/:id" element={<p>Published page</p>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
  }

  it('blocks submission and explains what is missing, without calling the API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ film }));
    renderForm();
    await userEvent.click(await screen.findByRole('button', { name: /publish interpretation/i }));
    expect(await screen.findByText('Give your interpretation a title.')).toBeInTheDocument();
    expect(screen.getByText('State your claim.')).toBeInTheDocument();
    expect(
      screen.getByText('Add at least one observation or scene reference.'),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('submits with the bearer token and the expected body, then opens the new page', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_url, init) =>
        init?.method === 'POST' ? json({ interpretation: { id: 'new1' } }, 201) : json({ film }),
      );
    renderForm();
    await userEvent.type(await screen.findByLabelText('Title'), 'Symmetry as control');
    await userEvent.type(screen.getByLabelText('Main claim'), 'The framing signals order.');
    await userEvent.type(screen.getByLabelText('Tags (optional)'), 'Motif, framing');
    await userEvent.type(
      screen.getByLabelText('What do you point to?'),
      'Both figures are centred in the frame.',
    );
    await userEvent.type(screen.getByLabelText('Timestamp (optional)'), '1:15');
    await userEvent.click(screen.getByRole('button', { name: /publish interpretation/i }));

    expect(await screen.findByText('Published page')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    const headers = post[1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      filmId: 'film1',
      title: 'Symmetry as control',
      claim: 'The framing signals order.',
      interpretationType: 'interpretation',
      spoilerLevel: 'none',
      evidence: [
        {
          evidenceType: 'observation',
          description: 'Both figures are centred in the frame.',
          timestampSeconds: 75,
        },
      ],
      tags: ['motif', 'framing'],
    });
  });

  it('shows server validation messages next to the field', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) =>
      init?.method === 'POST'
        ? json(
            {
              error: {
                code: 'validation_error',
                message: 'The request was invalid',
                details: [{ path: 'title', message: 'Too long' }],
              },
            },
            400,
          )
        : json({ film }),
    );
    renderForm();
    await userEvent.type(await screen.findByLabelText('Title'), 't');
    await userEvent.type(screen.getByLabelText('Main claim'), 'c');
    await userEvent.type(screen.getByLabelText('What do you point to?'), 'obs');
    await userEvent.click(screen.getByRole('button', { name: /publish interpretation/i }));
    await waitFor(() => expect(screen.getByText('Too long')).toBeInTheDocument());
  });
});
