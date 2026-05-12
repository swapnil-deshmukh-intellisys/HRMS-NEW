import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '1m', target: 50 },   // Stay at 50 users for 1 minute
    { duration: '30s', target: 100 }, // Spike to 100 users
    { duration: '1m', target: 100 },  // Stay at 100 users
    { duration: '30s', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate must be less than 1%
  },
};

const API_URL = __ENV.API_URL || 'http://localhost:4000/api';
const TOKEN = __ENV.TEST_TOKEN || 'dummy-token-for-load-test';

export default function () {
  const url = `${API_URL}/attendance/check-in`;
  const payload = JSON.stringify({
    localDateTime: new Date().toISOString(),
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'is status 200 or 201 or 409': (r) => [200, 201, 409].includes(r.status),
  });

  sleep(1);
}
