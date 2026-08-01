import { beforeEach, describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/db';
import { history } from '../store/ops';
import { setLang } from '../i18n';
import { App } from './App';

beforeEach(async () => {
  await Promise.all([db.trips.clear(), db.days.clear(), db.stops.clear(), db.dismissals.clear()]);
  history.length = 0;
  await setLang('en');
});

describe('App shell', () => {
  test('shows the trips list and navigates into a created trip and back', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Trips' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Trip name'), 'Greece');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('heading', { name: 'Greece' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Trips' })).toBeInTheDocument();
  });

  test('language toggle flips to Hebrew and RTL, and back', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'עברית' }));
    expect(document.documentElement.dir).toBe('rtl');
    expect(await screen.findByRole('heading', { name: 'טיולים' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(document.documentElement.dir).toBe('ltr');
  });
});
