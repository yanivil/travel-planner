import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../i18n';
import { db } from '../db/db';
import { history } from '../store/ops';
import { TripView } from './TripView';

beforeEach(async () => {
  await Promise.all([db.trips.clear(), db.days.clear(), db.stops.clear()]);
  history.length = 0;
  await i18n.changeLanguage('en');
  await db.trips.add({ id: 'trip-1', name: 'North weekend', createdAt: '2026-08-01T00:00:00.000Z' });
});

describe('TripView', () => {
  test('renders the trip, its day tabs, and the first day timeline by default', async () => {
    await db.days.bulkAdd([
      { id: 'd1', tripId: 'trip-1', index: 0, title: 'Thursday', startMin: 480, zone: 'Asia/Jerusalem' },
      { id: 'd2', tripId: 'trip-1', index: 1, title: 'Friday', startMin: 480, zone: 'Asia/Jerusalem' },
    ]);
    await db.stops.add({ id: 's1', dayId: 'd1', index: 0, name: 'Banias', kind: 'activity', durationMin: 120, legAfterMin: null });

    render(<TripView tripId="trip-1" onBack={() => {}} />);

    expect(await screen.findByRole('heading', { name: 'North weekend' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Thursday' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByDisplayValue('Banias')).toBeInTheDocument();
  });

  test('switching day tabs switches the visible timeline', async () => {
    await db.days.bulkAdd([
      { id: 'd1', tripId: 'trip-1', index: 0, title: 'Thursday', startMin: 480, zone: 'Asia/Jerusalem' },
      { id: 'd2', tripId: 'trip-1', index: 1, title: 'Friday', startMin: 540, zone: 'Asia/Jerusalem' },
    ]);
    await db.stops.add({ id: 's2', dayId: 'd2', index: 0, name: 'Timna', kind: 'activity', durationMin: 60, legAfterMin: null });
    const user = userEvent.setup();
    render(<TripView tripId="trip-1" onBack={() => {}} />);

    await user.click(await screen.findByRole('button', { name: 'Friday' }));
    expect(await screen.findByDisplayValue('Timna')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Friday' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('adding a day appends a numbered tab and selects it', async () => {
    const user = userEvent.setup();
    render(<TripView tripId="trip-1" onBack={() => {}} />);
    await screen.findByRole('heading', { name: 'North weekend' });

    await user.click(screen.getByRole('button', { name: /Add day/ }));

    const tab = await screen.findByRole('button', { name: 'Day 1' });
    expect(tab).toHaveAttribute('aria-pressed', 'true');
    expect(await db.days.count()).toBe(1);
  });

  test('back button calls onBack', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<TripView tripId="trip-1" onBack={onBack} />);
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
