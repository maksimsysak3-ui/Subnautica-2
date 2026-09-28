/**
 * City events: what refuses a booking, what a booking costs and when it is
 * on, what the gate brings in and the mood it leaves, the cooldown, and a
 * booking surviving a save with its venue found again.
 *
 *   node tools/events-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { CityEvents, EVENTS, eventById } from '${src}sim/events';`,
      `export { Budget } from '${src}sim/budget';`,
      `export { Newsroom } from '${src}sim/news';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

let failed = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); };

const VENUES = [
  { id: 11, x: 100, z: 50, name: 'Stadium', asset: 'svc.parks.stadium' },
  { id: 12, x: -300, z: 20, name: 'City square', asset: 'svc.parks.square' },
];
const city = (pop = 8000, venues = VENUES) => ({
  population: pop, visitors: 400,
  venues: (re) => venues.filter((v) => re.test(v.asset)),
});
const money = (n) => Object.assign(new M.Budget(), { balance: n });

check(M.EVENTS.length >= 5 && new Set(M.EVENTS.map((e) => e.id)).size === M.EVENTS.length, `${M.EVENTS.length} kinds of event, each its own`);

{
  const ev = new M.CityEvents(); const news = new M.Newsroom();
  const def = M.eventById('exhibition');
  check(/museum or gallery/.test(ev.refuse(def, 0, city(), money(1e7)) ?? ''), 'no museum, no exhibition');
  check(/residents/.test(ev.refuse(M.eventById('marathon'), 0, city(1000), money(1e7)) ?? ''), 'a village cannot hold a marathon');
  check(/treasury/.test(ev.refuse(M.eventById('match'), 0, city(), money(10)) ?? ''), 'nor can a broke city hold a match');
  check(ev.refuse(M.eventById('match'), 0, city(), money(1e7)) === null, 'a city with a stadium can');
}

{
  const ev = new M.CityEvents(); const news = new M.Newsroom(); const b = money(1e7);
  const err = ev.book('match', 10, city(), b, news);
  check(err === null && b.balance === 1e7 - M.eventById('match').cost, 'booking a match pays for it up front');
  check(ev.booked.venue === 11 && ev.booked.where === 'Stadium', 'at the stadium');
  check(ev.book('festival', 10, city(), b, news) !== null, 'one event at a time');
  check(ev.live(10.2) === null && ev.live(10.6) !== null, 'on the next day, not today');
  check(ev.visitors(10.6) > 0, `it brings visitors (${ev.visitors(10.6)})`);
  const crowd = ev.booked.crowd;
  check(ev.update(11.2, b, news) === null, 'still on until it ends');
  const before = b.balance;
  const done = ev.update(11.6, b, news);
  check(done?.finished?.takings === Math.round(crowd * M.eventById('match').ticket) && b.balance === before + done.finished.takings, `the gate is paid in (${done?.finished?.takings})`);
  check(ev.booked === null && ev.mood(12) > 0 && ev.mood(20) === 0, 'the city is happier for a few days, then not');
  check(/Again in/.test(ev.refuse(M.eventById('match'), 12, city(), b) ?? ''), 'and a match cannot be booked again straight away');
  check(ev.refuse(M.eventById('match'), 11.6 + M.eventById('match').cooldown + 0.1, city(), b) === null, 'until the cooldown is over');
  check(news.stories.length >= 2, 'the paper announces it and reports it');
}

{
  const ev = new M.CityEvents(); const b = money(1e7);
  ev.book('festival', 3, city(), b, new M.Newsroom());
  const back = new M.CityEvents();
  back.restore(JSON.parse(JSON.stringify(ev.saved())));
  check(back.booked?.id === 'festival' && back.booked.venue === -2, 'a booking survives a save, its venue to be found again');
  // The table is rebuilt in a new order on load: the square is another index now.
  back.relink(city(8000, [{ ...VENUES[1], id: 77 }, { ...VENUES[0], id: 78 }]));
  check(back.booked.venue === 77, 'and is found by where it stood');
  const junk = new M.CityEvents();
  junk.restore({ booked: { id: 'rave', from: 1 }, history: [{ id: 'nope', day: 1 }], last: { match: 'x' } });
  check(junk.booked === null && junk.history.length === 0, 'a mangled save is refused, not trusted');
}

console.log(`\n${checks} checks`);
console.log(failed === 0 ? 'EVENTS_OK' : `EVENTS: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
