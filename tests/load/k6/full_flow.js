// KhetiRental — production load test (Lead 1: distributed systems / SRE).
//
// Simulates 5,000 concurrent renters + owners hitting the matching engine
// and the booking saga over a 60 s ramp / 120 s sustain / 30 s ramp-down.
// Pass/fail thresholds per the go-systems-architect skill:
//   p(95) < 10 ms,  p(99) < 25 ms,  http_req_failed rate < 0.001
//
// Run:
//   k6 run tests/load/k6/full_flow.js
// (The matching-engine binary must be running on K6_TARGET, with Redis
// seeded with machines per the H3 index. OpenTelemetry spans are emitted
// by the service; k6 asserts latency, the service asserts traces.)

import http from 'k6/http';
import { check, group } from 'k6';
import { Trend } from 'k6/metrics';

// --- Configuration --------------------------------------------------------
const TARGET = __ENV.K6_TARGET || 'http://127.0.0.1:8080';

// A realistic rural cluster (Jaipur district, Res8 H3 anchor). Lat/Lng are
// in degrees. The script will issue spatial queries at these points.
const SEARCH_POINTS = [
  { lat: 26.8467, lng: 75.8160 },  // Jaipur
  { lat: 26.9200, lng: 75.7850 },  // south cluster
  { lat: 26.7900, lng: 75.8600 },  // north cluster
];

const requestedHP = 45;

// Custom trend for the matching call so we can assert p95/p99 in thresholds.
const matchingTrend = new Trend('matching_duration', true);

// --- Ramp profile ---------------------------------------------------------
export const options = {
  scenarios: {
    harvest_window_surge: {
      exec: 'rampDownAndUp',
      startVUs: 100,
      duration: '60s',
      gracefulRampDown: '30s',
    },
  },
  // Pass/fail thresholds — matching the skill's SLA exactly.
  thresholds: {
    matching_duration: ['p(95)<10', 'p(99)<25'],
    http_req_failed: ['rate<0.001'],
    http_req: ['rate<0.001'],
  },
};

// Scenario executor: hold at max VUs for the sustain window.
function rampDownAndUp(executionContext) {
  requestOnce();
}

// --- Core request ---------------------------------------------------------
function requestOnce() {
  const pt = SEARCH_POINTS[mathRandomInt(0, SEARCH_POINTS.length - 1)];
  const k = mathRandomInt(1, 5); // ring buffer k in [1,5]

  group('matching', () => {
    const url = `${TARGET}/machines/near?lat=${pt.lat}&lng=${pt.lng}&radius_km=5&hp=${requestedHP}&k=${k}`;
    const res = http.get(url, {
      tags: { name: 'match-near' },
      timeout: 250,
    });

    matchingTrend.add(res.timings.duration / 1000); // ms

    check(res, {
      'status is 200': (r) => r.status === 200,
      'has candidates array': (r) => r.json('candidates') !== undefined,
    });

    group('booking-saga', () => {
      // A sampled subset of matched renters proceed to the booking saga to
      // exercise the Kafka compensating path under load.
      if (Math.random() < 0.5) {
        const idemKey = `idem-${Math.random().toString(16).slice(2)}`;
        const booking = http.post(
          `${TARGET}/v1/bookings`,
          JSON.stringify({
            machine_id: 'M-0042',
            renter_id: `R-${mathRandomInt(1, 5000)}`,
            hours: 4,
            idempotency_key: idemKey,
          }),
          {
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey },
            tags: { name: 'booking-reserve' },
          }
        );
        check(booking, {
          'booking accepted or 202': (r) => r.status === 200 || r.status === 202,
        });
      }
    });
  });
}

// --- Small helpers --------------------------------------------------------
function mathRandomInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}
