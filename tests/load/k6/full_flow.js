// KhetiRental — harvest-surge load test (Lead 1: distributed systems / SRE).
//
// Ramps 100 → 5,000 concurrent VUs over 60 s, sustains 120 s, ramps down 30 s
// against the matching engine. SLA gates per the k6-telemetry-benchmark skill:
//   match-near p(95) < 10 ms, p(99) < 25 ms; http_req_failed rate < 0.1 %
//
// Run (matching engine + Redis up; setup() seeds the H3 index):
//   k6 run tests/load/k6/full_flow.js
// Env:
//   K6_TARGET        matching engine base URL (default http://127.0.0.1:8080)
//   SEED_MACHINES    machines to index in setup() (default 20000, spread over
//                    a ~110 km box around Jaipur ≈ 130 per 5 km search)
//   BOOKING_TARGET   booking API base URL; the booking-saga group runs only
//                    when set (no booking HTTP service ships yet)

import http from 'k6/http';
import { check, group, sleep } from 'k6';

const TARGET = __ENV.K6_TARGET || 'http://127.0.0.1:8080';
const BOOKING_TARGET = __ENV.BOOKING_TARGET || '';
const SEED_MACHINES = Number(__ENV.SEED_MACHINES || 20000);
const HP_TIERS = [35, 45, 55, 75];

// Rural search points around Jaipur district.
const SEARCH_POINTS = [
  { lat: 26.8467, lng: 75.8160 }, // Jaipur
  { lat: 26.9200, lng: 75.7850 }, // north cluster
  { lat: 26.7900, lng: 75.8600 }, // south-east cluster
];

export const options = {
  setupTimeout: '120s',
  scenarios: {
    harvest_window_surge: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '60s', target: 5000 },
        { duration: '120s', target: 5000 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    'http_req_duration{name:match-near}': ['p(95)<10', 'p(99)<25'],
    http_req_failed: ['rate<0.001'],
  },
};

// Seed machines uniformly over a ±0.5° (~110 km) box centred on Jaipur.
export function setup() {
  const reqs = [];
  for (let i = 0; i < SEED_MACHINES; i++) {
    reqs.push(['POST', `${TARGET}/machines/index`, JSON.stringify({
      id: `M-${String(i).padStart(5, '0')}`,
      lat: SEARCH_POINTS[0].lat + (Math.random() - 0.5),
      lng: SEARCH_POINTS[0].lng + (Math.random() - 0.5),
      hp: HP_TIERS[i % HP_TIERS.length],
      reputation: Math.random(),
    }), { headers: { 'Content-Type': 'application/json' }, tags: { name: 'seed' } }]);
  }
  for (let i = 0; i < reqs.length; i += 200) {
    http.batch(reqs.slice(i, i + 200)).forEach((r) => {
      if (r.status !== 204) throw new Error(`seed failed: ${r.status} ${r.body}`);
    });
  }
}

export default function () {
  const pt = SEARCH_POINTS[randInt(0, SEARCH_POINTS.length - 1)];

  group('matching', () => {
    const res = http.get(
      `${TARGET}/machines/near?lat=${pt.lat}&lng=${pt.lng}&radius_km=5&hp=45&k=${randInt(1, 5)}`,
      { tags: { name: 'match-near' }, timeout: '2s' },
    );
    check(res, {
      'status is 200': (r) => r.status === 200,
      'has candidates': (r) => r.status === 200 && Array.isArray(r.json('candidates')),
    });
  });

  // Half of matched renters proceed to booking to exercise the saga under load.
  if (BOOKING_TARGET && Math.random() < 0.5) {
    group('booking-saga', () => {
      const idemKey = `idem-${__VU}-${__ITER}`;
      const res = http.post(
        `${BOOKING_TARGET}/v1/bookings`,
        JSON.stringify({ machine_id: `M-${String(randInt(0, SEED_MACHINES - 1)).padStart(5, '0')}`, renter_id: `R-${__VU}`, hours: 4 }),
        { headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey }, tags: { name: 'booking-reserve' } },
      );
      check(res, { 'booking 200/202': (r) => r.status === 200 || r.status === 202 });
    });
  }
  thinkTime();
}

// Renter think time between searches; without it 5,000 closed-loop VUs on one
// host measure queueing (Little's law), not service latency.
function thinkTime() {
  sleep(0.5 + Math.random());
}

function randInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}
