import { beforeEach, describe, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/db';
import { resetHistory } from '../store/ops';
import { setLang } from '../i18n';
import { App } from './App';

beforeEach(async () => {
  await Promise.all([db.trips.clear(), db.days.clear(), db.stops.clear(), db.dismissals.clear()]);
  resetHistory();
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

  test('undo removes the just-created trip (with a toast) and redo brings it back', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText('Trip name'), 'Golan');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByRole('heading', { name: 'Golan' });

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    // the open trip vanished — the view falls back to the (now empty) list
    expect(await screen.findByText(/no trips yet/i)).toBeInTheDocument();
    expect(screen.getByText('Undone: create trip')).toBeInTheDocument();
    expect(await db.trips.count()).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(await screen.findByRole('button', { name: 'Golan' })).toBeInTheDocument();
    expect(screen.getByText('Redone: create trip')).toBeInTheDocument();
    expect(await db.trips.count()).toBe(1);
  });

  test('Ctrl+Z triggers undo from the keyboard (outside form fields)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText('Trip name'), 'Golan');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByRole('heading', { name: 'Golan' });

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    expect(await screen.findByText(/no trips yet/i)).toBeInTheDocument();
    expect(await db.trips.count()).toBe(0);
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
