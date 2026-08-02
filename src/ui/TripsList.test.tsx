import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../i18n';
import { db } from '../db/db';
import { history } from '../store/ops';
import { TripsList } from './TripsList';

beforeEach(async () => {
  await Promise.all([db.trips.clear(), db.days.clear(), db.stops.clear(), db.dismissals.clear()]);
  history.length = 0;
  await i18n.changeLanguage('en');
});

describe('TripsList', () => {
  test('shows the empty state until a trip exists', async () => {
    render(<TripsList onOpen={() => {}} />);
    expect(await screen.findByText(/no trips yet/i)).toBeInTheDocument();
  });

  test('creates a trip, persists it, and opens it', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<TripsList onOpen={onOpen} />);

    await user.type(screen.getByLabelText('Trip name'), 'Golan weekend');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Golan weekend' })).toBeInTheDocument();
    expect(await db.trips.count()).toBe(1);
  });

  test('whitespace-only names are rejected', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<TripsList onOpen={onOpen} />);
    await user.type(screen.getByLabelText('Trip name'), '   ');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(await db.trips.count()).toBe(0);
  });

  test('delete asks for confirmation and cascades days and stops', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    await db.trips.add({ id: 'trip-1', name: 'Doomed', createdAt: '2026-08-01T00:00:00.000Z', maxDriveStretchMin: null });
    await db.days.add({ id: 'd1', tripId: 'trip-1', index: 0, title: 'Day 1', startMin: 480, zone: 'Asia/Jerusalem', curfewMin: null });
    await db.stops.add({ id: 's1', dayId: 'd1', index: 0, name: 'X', kind: 'activity', durationMin: 60, legAfterMin: null, anchorStartMin: null, openMin: null, closeMin: null, lastEntryMin: null, closedWeekdays: null });

    render(<TripsList onOpen={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(await screen.findByText(/no trips yet/i)).toBeInTheDocument();
    expect(await db.days.count()).toBe(0);
    expect(await db.stops.count()).toBe(0);
    confirmSpy.mockRestore();
  });

  test('declining the confirmation keeps the trip', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    await db.trips.add({ id: 'trip-1', name: 'Safe', createdAt: '2026-08-01T00:00:00.000Z', maxDriveStretchMin: null });

    render(<TripsList onOpen={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(await db.trips.count()).toBe(1);
    confirmSpy.mockRestore();
  });

  test('the demo trip seeds a full Yahel weekend and opens it', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<TripsList onOpen={onOpen} />);

    await user.click(screen.getByRole('button', { name: 'Load demo trip (Yahel)' }));

    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
    expect(await db.trips.count()).toBe(1);
    expect(await db.days.count()).toBe(4);
    expect(await db.stops.count()).toBeGreaterThan(15);
  });
});
