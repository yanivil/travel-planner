import { beforeEach, describe, expect, test } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n, { setLang } from '../i18n';
import { db } from '../db/db';
import { resetHistory } from '../store/ops';
import type { Day, Stop } from '../domain/types';
import { DayTimeline } from './DayTimeline';

const day: Day = {
  id: 'day-1',
  tripId: 'trip-1',
  index: 0,
  title: 'Day 1',
  startMin: 480,
  zone: 'Asia/Jerusalem',
  curfewMin: null,
  lat: null,
  lng: null,
  locationName: null,
};

function stop(id: string, index: number, patch: Partial<Stop> = {}): Stop {
  return {
    id,
    dayId: day.id,
    index,
    name: `Stop ${id}`,
    kind: 'activity',
    durationMin: 60,
    legAfterMin: null,
    anchorStartMin: null,
    openMin: null,
    closeMin: null,
    lastEntryMin: null,
    closedWeekdays: null,
    ...patch,
  } as Stop;
}

beforeEach(async () => {
  await Promise.all([db.trips.clear(), db.days.clear(), db.stops.clear(), db.dismissals.clear()]);
  resetHistory();
  await i18n.changeLanguage('en');
  await db.days.add(day);
});

describe('DayTimeline behavior (tested via the DOM, never internals)', () => {
  test('renders computed times: pool 150m, 25m drive, timna arrives 10:55', async () => {
    await db.stops.bulkAdd([
      stop('pool', 0, { name: 'Pool', durationMin: 150, legAfterMin: 25 }),
      stop('timna', 1, { name: 'Timna', durationMin: 180, wazeQuery: 'Timna Park' }),
    ]);
    render(<DayTimeline dayId={day.id} />);

    expect(await screen.findByText('08:00–10:30')).toBeInTheDocument();
    expect(screen.getByText('10:55–13:55')).toBeInTheDocument();
    expect(screen.getByText(/25 min · 10:55/)).toBeInTheDocument();
    const waze = screen.getByRole('link', { name: /Waze/ });
    expect(waze).toHaveAttribute('href', 'https://waze.com/ul?q=Timna%20Park&navigate=yes');
  });

  test('adding a stop through the form appends it with recomputed times', async () => {
    const user = userEvent.setup();
    render(<DayTimeline dayId={day.id} />);
    await screen.findByText(/no stops yet/i);

    await user.type(screen.getByLabelText('Stop name'), 'Lunch');
    const duration = screen.getByLabelText('Duration (min)');
    await user.clear(duration);
    await user.type(duration, '45');
    await user.click(screen.getByRole('button', { name: 'Add stop' }));

    expect(await screen.findByText('08:00–08:45')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Lunch')).toBeInTheDocument();
  });

  test('move-down reorders stops and every downstream time recomputes', async () => {
    await db.stops.bulkAdd([
      stop('a', 0, { name: 'Alpha', durationMin: 60 }),
      stop('b', 1, { name: 'Beta', durationMin: 30 }),
    ]);
    const user = userEvent.setup();
    render(<DayTimeline dayId={day.id} />);

    expect(await screen.findByText('08:00–09:00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Move down: Alpha' }));

    // Beta now leads (08:00–08:30) and Alpha follows (08:30–09:30)
    expect(await screen.findByText('08:00–08:30')).toBeInTheDocument();
    expect(screen.getByText('08:30–09:30')).toBeInTheDocument();
  });

  test('editing a duration recomputes downstream arrival times', async () => {
    await db.stops.bulkAdd([
      stop('a', 0, { name: 'Alpha', durationMin: 60 }),
      stop('b', 1, { name: 'Beta', durationMin: 30 }),
    ]);
    render(<DayTimeline dayId={day.id} />);
    await screen.findByText('09:00–09:30');

    fireEvent.change(screen.getByLabelText('Duration (min) — Alpha'), { target: { value: '90' } });

    expect(await screen.findByText('09:30–10:00')).toBeInTheDocument();
  });

  test('deleting a stop removes it and closes the schedule gap', async () => {
    await db.stops.bulkAdd([
      stop('a', 0, { name: 'Alpha', durationMin: 60, legAfterMin: 15 }),
      stop('b', 1, { name: 'Beta', durationMin: 30 }),
    ]);
    const user = userEvent.setup();
    render(<DayTimeline dayId={day.id} />);
    await screen.findByText('09:15–09:45');

    await user.click(screen.getByRole('button', { name: 'Delete: Alpha' }));

    expect(await screen.findByText('08:00–08:30')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Alpha')).not.toBeInTheDocument();
    expect(await db.stops.count()).toBe(1);
  });

  test('renaming a stop commits on blur', async () => {
    await db.stops.add(stop('a', 0, { name: 'Old name' }));
    const user = userEvent.setup();
    render(<DayTimeline dayId={day.id} />);

    const name = await screen.findByDisplayValue('Old name');
    await user.clear(name);
    await user.type(name, 'New name');
    await user.tab();

    await screen.findByDisplayValue('New name');
    expect((await db.stops.get('a'))?.name).toBe('New name');
  });

  test('changing the day start shifts the whole schedule', async () => {
    await db.stops.add(stop('a', 0, { name: 'Alpha', durationMin: 60 }));
    render(<DayTimeline dayId={day.id} />);
    await screen.findByText('08:00–09:00');

    fireEvent.change(screen.getByLabelText(/Day start/), { target: { value: '09:30' } });

    expect(await screen.findByText('09:30–10:30')).toBeInTheDocument();
  });

  test('pinning a stop then moving the pin later shows slack and pins the start (D-025)', async () => {
    await db.stops.bulkAdd([
      stop('a', 0, { name: 'Drive', durationMin: 60 }),
      stop('b', 1, { name: 'Lunch', durationMin: 60 }),
    ]);
    const user = userEvent.setup();
    render(<DayTimeline dayId={day.id} />);
    await screen.findByText('09:00–10:00');

    await user.click(screen.getByRole('button', { name: 'Pin time: Lunch' }));
    fireEvent.change(await screen.findByLabelText('Pinned start — Lunch'), {
      target: { value: '09:45' },
    });

    expect(await screen.findByText('09:45–10:45')).toBeInTheDocument();
    expect(screen.getByText(/45 min wait/)).toBeInTheDocument();
  });

  test('pinning earlier than the previous end raises a hard OVERLAP conflict (chip + drawer)', async () => {
    await db.stops.bulkAdd([
      stop('a', 0, { name: 'Drive', durationMin: 60 }),
      stop('b', 1, { name: 'Tour', durationMin: 90 }),
    ]);
    const user = userEvent.setup();
    render(<DayTimeline dayId={day.id} />);
    await screen.findByText('09:00–10:30');

    await user.click(screen.getByRole('button', { name: 'Pin time: Tour' }));
    fireEvent.change(await screen.findByLabelText('Pinned start — Tour'), {
      target: { value: '08:30' },
    });

    expect(await screen.findByText('08:30–10:00')).toBeInTheDocument();
    // appears twice by design: chip on the card and card in the drawer
    const msgs = await screen.findAllByText(/"Tour" starts before "Drive" ends \(30 min overlap\)/);
    expect(msgs.length).toBeGreaterThanOrEqual(2);
    // hard conflicts are infeasible — they cannot be acknowledged away
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
  });

  test('a curfew miss is soft: acknowledgeable, persisted, and listed under Acknowledged (D-020)', async () => {
    await db.days.update(day.id, { curfewMin: 600 });
    await db.stops.add(stop('a', 0, { name: 'Dinner', durationMin: 150 }));
    const user = userEvent.setup();
    render(<DayTimeline dayId={day.id} />);

    expect(
      await screen.findByText('The day ends 30 min after the 10:00 curfew'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Acknowledge' }));

    // Ack/re-raise both update TWO live queries back-to-back (dismissals +
    // the recomputed conflict list), so the panel re-renders twice in quick
    // succession — a node captured by findBy can be REPLACED before its
    // assertion runs ("element could not be found in the document", CI-only).
    // waitFor + getBy re-queries on every poll; event-driven, no sleeps.
    await waitFor(() => expect(screen.getByText(/No conflicts/)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByRole('button', { name: 'Acknowledged (1)' })).toBeInTheDocument();
    expect(await db.dismissals.count()).toBe(1);

    // and it can be re-raised — settle the data layer first, then the UI
    await user.click(screen.getByRole('button', { name: 'Acknowledged (1)' }));
    await user.click(screen.getByRole('button', { name: 'Re-raise' }));
    await waitFor(async () => expect(await db.dismissals.count()).toBe(0), { timeout: 3000 });
    await waitFor(
      () => expect(screen.getByText('The day ends 30 min after the 10:00 curfew')).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  test('opening the details editor and setting a last-entry raises the arrival conflict', async () => {
    await db.stops.bulkAdd([
      stop('a', 0, { name: 'Drive', durationMin: 120, legAfterMin: 30 }),
      stop('b', 1, { name: 'Timna', durationMin: 60 }),
    ]);
    const user = userEvent.setup();
    render(<DayTimeline dayId={day.id} />);
    await screen.findByText('10:30–11:30');

    await user.click(screen.getByRole('button', { name: 'Details: Timna' }));
    fireEvent.change(screen.getByLabelText('Last entry — Timna'), { target: { value: '10:00' } });

    const msgs = await screen.findAllByText(/Arrives at "Timna" 30 min after last entry \(10:00\)/);
    expect(msgs.length).toBeGreaterThanOrEqual(2);
  });

  test('R-001: an async echo must not clobber digits the user is still typing', async () => {
    await db.stops.bulkAdd([
      stop('a', 0, { name: 'Alpha', durationMin: 60 }),
      stop('b', 1, { name: 'Beta', durationMin: 30 }),
    ]);
    render(<DayTimeline dayId={day.id} />);
    const leg = (await screen.findByLabelText('Drive to next stop (min) — Alpha')) as HTMLInputElement;

    // the user typed two digits; wait for that commit to land...
    fireEvent.focus(leg);
    fireEvent.change(leg, { target: { value: '33' } });
    await waitFor(async () => expect((await db.stops.get('a'))?.legAfterMin).toBe(33));

    // ...then a stale echo of an EARLIER keystroke arrives while still focused
    await db.stops.update('a', { legAfterMin: 3 });
    // wait until that echo has demonstrably re-rendered (the leg row shows it)...
    await screen.findByText(/🚗 3 min/);

    // ...the focused field must still hold the user's draft, not the echo
    expect(leg.value).toBe('33');
    fireEvent.blur(leg);
  });

  test('R-001: typing a multi-digit drive time keeps every keystroke end-to-end', async () => {
    await db.stops.bulkAdd([
      stop('a', 0, { name: 'Alpha', durationMin: 60 }),
      stop('b', 1, { name: 'Beta', durationMin: 30 }),
    ]);
    const user = userEvent.setup();
    render(<DayTimeline dayId={day.id} />);
    const leg = (await screen.findByLabelText('Drive to next stop (min) — Alpha')) as HTMLInputElement;

    await user.clear(leg);
    await user.type(leg, '333');
    await user.tab();

    await waitFor(async () => expect((await db.stops.get('a'))?.legAfterMin).toBe(333));
    expect(await screen.findByText(/333 min/)).toBeInTheDocument();
  });

  test('a Friday with a location shows the candle badge and the Shabbat band (real Yahel zmanim)', async () => {
    await db.days.update(day.id, {
      date: '2026-08-28',
      lat: 29.878,
      lng: 35.096,
      locationName: 'קיבוץ יהל (ערבה)',
    });
    await db.stops.add(stop('a', 0, { name: 'Pool', durationMin: 60 }));
    render(<DayTimeline dayId={day.id} />);

    expect(await screen.findByText(/Candles 18:46/)).toBeInTheDocument();
    expect(screen.getByText(/Shabbat enters · 18:46/)).toBeInTheDocument();
  });

  test('observance=soft turns a post-candles drive into a SHABBAT_CONFLICT', async () => {
    await db.trips.add({
      id: day.tripId,
      name: 'T',
      createdAt: '2026-08-01T00:00:00.000Z',
      maxDriveStretchMin: null,
      observance: 'soft',
    });
    await db.days.update(day.id, {
      startMin: 17 * 60,
      date: '2026-08-28',
      lat: 29.878,
      lng: 35.096,
      locationName: 'קיבוץ יהל (ערבה)',
    });
    await db.stops.bulkAdd([
      stop('a', 0, { name: 'Lookout', durationMin: 60, legAfterMin: 60 }), // arrive 19:00 > 18:46
      stop('b', 1, { name: 'Lodge', durationMin: 60 }),
    ]);
    render(<DayTimeline dayId={day.id} />);

    const msgs = await screen.findAllByText(/Driving after candle-lighting \(18:46\) — leaving "Lookout"/);
    expect(msgs.length).toBeGreaterThanOrEqual(2);
  });

  test('a wallet file attaches to a stop, lists, and deletes (D-028)', async () => {
    await Promise.all([db.attachments.clear()]);
    await db.stops.add(stop('a', 0, { name: 'Timna' }));
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = (() => 'blob:test') as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
    try {
      const user = userEvent.setup();
      render(<DayTimeline dayId={day.id} />);
      await user.click(await screen.findByRole('button', { name: 'Details: Timna' }));

      const file = new File([new Uint8Array([137, 80, 78, 71])], 'ticket.png', { type: 'image/png' });
      await user.upload(screen.getByLabelText('Attach file — Timna'), file);

      expect(await screen.findByText('ticket.png')).toBeInTheDocument();
      expect(await db.attachments.count()).toBe(1);
      expect((await db.attachments.toArray())[0]?.tripId).toBe(day.tripId);

      await user.click(screen.getByRole('button', { name: 'Delete: ticket.png' }));
      await waitFor(async () => expect(await db.attachments.count()).toBe(0));
    } finally {
      URL.createObjectURL = origCreate;
    }
  });

  test('renders Hebrew with RTL document direction (component-level RTL assertion)', async () => {
    await setLang('he');
    await db.stops.add(stop('a', 0, { name: 'בריכה', durationMin: 150 }));
    render(<DayTimeline dayId={day.id} />);

    expect(await screen.findByText('08:00–10:30')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByRole('button', { name: 'הוספת עצירה' })).toBeInTheDocument();
  });
});
