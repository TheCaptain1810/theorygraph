import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Profile } from './Profile';

afterEach(() => vi.restoreAllMocks());

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/profile/sam']}>
      <Routes>
        <Route path="/profile/:username" element={<Profile />} />
      </Routes>
    </MemoryRouter>,
  );
}

const base = {
  user: {
    username: 'sam',
    displayName: null,
    bio: 'Likes long takes.',
    joinedAt: '2026-01-01T00:00:00Z',
  },
  interpretations: { items: [], total: 0, page: 1, pageSize: 20 },
  counterReadings: { total: 0, items: [] },
};

describe('Profile page', () => {
  it('shows an honest empty state for a new user', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(base));
    renderProfile();
    expect(await screen.findByRole('heading', { name: 'sam' })).toBeInTheDocument();
    expect(screen.getByText('Likes long takes.')).toBeInTheDocument();
    expect(screen.getByText('No interpretations yet')).toBeInTheDocument();
    expect(screen.getByText('No counter-readings yet')).toBeInTheDocument();
  });

  it('renders concealed contributions without any spoiler text, and open ones as links', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      json({
        ...base,
        interpretations: {
          total: 1,
          page: 1,
          pageSize: 20,
          items: [
            {
              concealed: true,
              id: 'i1',
              filmId: 'f1',
              filmTitle: 'Some Film',
              interpretationType: 'interpretation',
              spoilerLevel: 'major',
              evidenceCount: 1,
              counterReadingCount: 0,
              createdAt: '2026-01-01T00:00:00Z',
            },
          ],
        },
        counterReadings: {
          total: 2,
          items: [
            {
              id: 'c1',
              interpretationId: 'i1',
              filmId: 'f1',
              filmTitle: 'Some Film',
              spoilerLevel: 'major',
              createdAt: '2026-01-01T00:00:00Z',
              concealed: true,
            },
            {
              id: 'c2',
              interpretationId: 'i2',
              filmId: 'f1',
              filmTitle: 'Some Film',
              spoilerLevel: 'none',
              createdAt: '2026-01-01T00:00:00Z',
              concealed: false,
              excerpt: 'An open excerpt',
            },
          ],
        },
      }),
    );
    renderProfile();
    expect(await screen.findByText(/contains major spoilers/i)).toBeInTheDocument();
    expect(
      screen.getByText(/the interpretation it answers has major spoilers/i),
    ).toBeInTheDocument();
    expect(screen.getByText('An open excerpt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /read in context/i })).toHaveAttribute(
      'href',
      '/interpretations/i2',
    );
  });

  it('shows not-found and error states', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      json({ error: { code: 'not_found', message: 'nope' } }, 404),
    );
    const { unmount } = renderProfile();
    expect(await screen.findByText('User not found')).toBeInTheDocument();
    unmount();
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      json({ error: { code: 'internal_error', message: 'boom' } }, 500),
    );
    renderProfile();
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });
});
