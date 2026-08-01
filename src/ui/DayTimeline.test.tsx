import { beforeEach, describe, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n, { setLang } from '../i18n';
import { db } from '../db/db';
import { history } from '../store/ops';
import type { Day, Stop } from '../domain/types';
import { DayTimeline } from './DayTimeline';

const day: Day = {
  id: 'day-1',
  tripId: 'trip-1',
  index: 0,
  title: 'Day 1',
  startMin: 480,
  zone: 'Asia/Jerusalem',
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
    ...patch,
  };
}

beforeEach(async () => {
  await Promise.all([db.trips.clear(), db.days.clear(), db.stops.clear()]);
  history.length = 0;
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

    // one change event, not per-keystroke typing: the input is controlled by an
    // async live query, so keystroke streams race the store round-trip
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

  test('pinning earlier than the chain arrival flags lateness, never shifts silently', async () => {
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
    expect(screen.getByText(/Late by 30 min/)).toBeInTheDocument();
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
