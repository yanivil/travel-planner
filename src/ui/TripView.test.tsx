import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../i18n';
import { db } from '../db/db';
import { resetHistory } from '../store/ops';
import { TripView } from './TripView';

beforeEach(async () => {
  await Promise.all([db.trips.clear(), db.days.clear(), db.stops.clear(), db.dismissals.clear()]);
  resetHistory();
  await i18n.changeLanguage('en');
  await db.trips.add({ id: 'trip-1', name: 'North weekend', createdAt: '2026-08-01T00:00:00.000Z', maxDriveStretchMin: null, observance: 'none' });
});

describe('TripView', () => {
  test('renders the trip, its day tabs, and the first day timeline by default', async () => {
    await db.days.bulkAdd([
      { id: 'd1', tripId: 'trip-1', index: 0, title: 'Thursday', startMin: 480, zone: 'Asia/Jerusalem', curfewMin: null, lat: null, lng: null, locationName: null },
      { id: 'd2', tripId: 'trip-1', index: 1, title: 'Friday', startMin: 480, zone: 'Asia/Jerusalem', curfewMin: null, lat: null, lng: null, locationName: null },
    ]);
    await db.stops.add({ id: 's1', dayId: 'd1', index: 0, name: 'Banias', kind: 'activity', durationMin: 120, legAfterMin: null, anchorStartMin: null, openMin: null, closeMin: null, lastEntryMin: null, closedWeekdays: null });

    render(<TripView tripId="trip-1" onBack={() => {}} />);

    expect(await screen.findByRole('heading', { name: 'North weekend' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Thursday' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByDisplayValue('Banias')).toBeInTheDocument();
  });

  test('switching day tabs switches the visible timeline', async () => {
    await db.days.bulkAdd([
      { id: 'd1', tripId: 'trip-1', index: 0, title: 'Thursday', startMin: 480, zone: 'Asia/Jerusalem', curfewMin: null, lat: null, lng: null, locationName: null },
      { id: 'd2', tripId: 'trip-1', index: 1, title: 'Friday', startMin: 540, zone: 'Asia/Jerusalem', curfewMin: null, lat: null, lng: null, locationName: null },
    ]);
    await db.stops.add({ id: 's2', dayId: 'd2', index: 0, name: 'Timna', kind: 'activity', durationMin: 60, legAfterMin: null, anchorStartMin: null, openMin: null, closeMin: null, lastEntryMin: null, closedWeekdays: null });
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

  test('renaming the trip commits on blur and updates the heading', async () => {
    const user = userEvent.setup();
    render(<TripView tripId="trip-1" onBack={() => {}} />);
    await screen.findByRole('heading', { name: 'North weekend' });

    await user.click(screen.getByRole('button', { name: 'Rename trip: North weekend' }));
    const input = screen.getByLabelText('Trip name');
    await user.clear(input);
    await user.type(input, 'Golan 2026');
    await user.tab();

    expect(await screen.findByRole('heading', { name: 'Golan 2026' })).toBeInTheDocument();
    expect((await db.trips.get('trip-1'))?.name).toBe('Golan 2026');
  });

  test('a blank rename is rejected and the old name stays', async () => {
    const user = userEvent.setup();
    render(<TripView tripId="trip-1" onBack={() => {}} />);
    await screen.findByRole('heading', { name: 'North weekend' });

    await user.click(screen.getByRole('button', { name: 'Rename trip: North weekend' }));
    await user.clear(screen.getByLabelText('Trip name'));
    await user.tab();

    expect(await screen.findByRole('heading', { name: 'North weekend' })).toBeInTheDocument();
    expect((await db.trips.get('trip-1'))?.name).toBe('North weekend');
  });

  test('the Shabbat observance setting persists through the op store', async () => {
    const user = userEvent.setup();
    render(<TripView tripId="trip-1" onBack={() => {}} />);
    await screen.findByRole('heading', { name: 'North weekend' });

    await user.selectOptions(screen.getByLabelText('Shabbat observance'), 'soft');

    expect((await db.trips.get('trip-1'))?.observance).toBe('soft');
  });

  test('export builds a self-contained HTML blob with the computed plan (#17)', async () => {
    await db.days.bulkAdd([
      { id: 'd1', tripId: 'trip-1', index: 0, title: 'Friday', date: '2026-08-28', startMin: 480, zone: 'Asia/Jerusalem', curfewMin: null, lat: 29.878, lng: 35.096, locationName: 'קיבוץ יהל (ערבה)' },
    ]);
    await db.stops.add({ id: 's1', dayId: 'd1', index: 0, name: 'בריכה', kind: 'activity', durationMin: 150, legAfterMin: null, anchorStartMin: null, openMin: null, closeMin: null, lastEntryMin: null, closedWeekdays: null });

    const captured: Blob[] = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((b: Blob) => {
      captured.push(b);
      return 'blob:test';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;

    try {
      const user = userEvent.setup();
      render(<TripView tripId="trip-1" onBack={() => {}} />);
      await screen.findByRole('heading', { name: 'North weekend' });
      await user.click(screen.getByRole('button', { name: 'Export (HTML)' }));

      await waitFor(() => expect(captured).toHaveLength(1));
      const html = await captured[0]!.text();
      expect(html).toContain('North weekend');
      expect(html).toContain('08:00–10:30'); // computed schedule, not raw data
      expect(html).toContain('Candles 18:46'); // offline zmanim ride along (EN labels, HE data)
      expect(html).toContain('name="tiyul-schema-version" content="4"');
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  test('back button calls onBack', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<TripView tripId="trip-1" onBack={onBack} />);
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
