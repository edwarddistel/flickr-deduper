import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler, zonedParts } from '../src/scheduler.js';

test('timezone conversion honors New York daylight savings', () => {
  assert.deepEqual(zonedParts(new Date('2026-01-10T08:00:00Z'), 'America/New_York'), { date: '2026-01-10', time: '03:00' });
  assert.deepEqual(zonedParts(new Date('2026-07-10T07:00:00Z'), 'America/New_York'), { date: '2026-07-10', time: '03:00' });
});

test('scheduler triggers one nightly run and never repeats same date', async () => {
  let ticks = 0;
  let runCount = 0;
  const scheduler = createScheduler({ sync: async () => { runCount++; } }, { syncTime: '03:00', timezone: 'America/New_York' }, {
    now: () => new Date('2026-01-10T08:00:00Z'),
    setIntervalImpl: (fn) => { ticks = fn; return 1; },
    log: () => {},
  });
  await scheduler.tick();
  await scheduler.tick();
  await ticks();
  assert.equal(runCount, 1);
  scheduler.stop();
});

test('scheduler rejects bad HH:MM configuration', () => {
  assert.throws(() => createScheduler({}, { syncTime: '25:00', timezone: 'UTC' }), /HH:MM/);
});
