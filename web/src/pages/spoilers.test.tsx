import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InterpretationSummary } from '../api/types';
import { InterpretationCard } from '../components/InterpretationCard';
import { safeHref } from '../components/EvidenceList';
import { InterpretationDetail } from './InterpretationDetail';

afterEach(() => vi.restoreAllMocks());

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );

const concealed = {
  concealed: true,
  id: 'abc',
  filmId: 'film1',
  interpretationType: 'interpretation',
  spoilerLevel: 'major',
  evidenceCount: 1,
  counterReadingCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
};
const revealed = {
  concealed: false,
  id: 'abc',
  filmId: 'film1',
  author: { username: 'sample', displayName: null },
  title: 'SECRET TITLE',
  claim: 'SECRET CLAIM',
  interpretationType: 'interpretation',
  spoilerLevel: 'major',
  tags: [],
  evidence: [],
  counterReadings: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/interpretations/abc']}>
      <Routes>
        <Route path="/interpretations/:interpretationId" element={<InterpretationDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('spoiler gate (UI)', () => {
  it('shows nothing spoiler-bearing until the reader deliberately reveals', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      return json({ interpretation: url.includes('reveal=true') ? revealed : concealed });
    });
    renderDetail();

    const button = await screen.findByRole('button', { name: /reveal major spoilers/i });
    expect(screen.getByText('Major spoilers')).toBeInTheDocument(); // status is text, not colour alone
    expect(screen.queryByText('SECRET CLAIM')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('reveal=true'))).toBe(false);

    await userEvent.click(button);
    expect(await screen.findByText('SECRET CLAIM')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('reveal=true'))).toBe(true);
  });

  it('shows an error state with retry when the API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      json({ error: { code: 'internal_error', message: 'boom' } }, 500),
    );
    renderDetail();
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows a not-found state for removed or unknown interpretations', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      json({ error: { code: 'not_found', message: 'nope' } }, 404),
    );
    renderDetail();
    expect(await screen.findByText('Interpretation not found')).toBeInTheDocument();
  });
});

describe('InterpretationCard', () => {
  const base = {
    id: 'x',
    filmId: 'f',
    interpretationType: 'interpretation',
    evidenceCount: 2,
    counterReadingCount: 1,
    createdAt: '2026-01-01T00:00:00Z',
  } as const;

  it('renders no title or claim for concealed items', () => {
    const item: InterpretationSummary = { ...base, concealed: true, spoilerLevel: 'major' };
    render(
      <MemoryRouter>
        <ul>
          <InterpretationCard item={item} />
        </ul>
      </MemoryRouter>,
    );
    expect(screen.getByText(/contains major spoilers/i)).toBeInTheDocument();
    expect(screen.getByText('Major spoilers')).toBeInTheDocument();
  });

  it('renders title and claim for non-concealed items', () => {
    const item: InterpretationSummary = {
      ...base,
      concealed: false,
      spoilerLevel: 'none',
      title: 'Open title',
      claim: 'Open claim',
      tags: ['a'],
      author: { username: 'u', displayName: null },
    };
    render(
      <MemoryRouter>
        <ul>
          <InterpretationCard item={item} />
        </ul>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Open title' })).toBeInTheDocument();
    expect(screen.getByText('Open claim')).toBeInTheDocument();
  });
});

describe('safeHref', () => {
  it('allows http(s) only', () => {
    expect(safeHref('https://example.com/a')).toBe('https://example.com/a');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,hi')).toBeNull();
    expect(safeHref('nonsense')).toBeNull();
    expect(safeHref(null)).toBeNull();
  });
});
