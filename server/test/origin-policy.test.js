import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeOrigin,
  createAllowedOrigins,
  getRequestOrigin,
  isTrustedRequestOrigin,
  isCorsOriginAllowed
} from '../src/origin-policy.js';

function mockRequest(headers = {}, protocol = 'http') {
  return {
    protocol,
    get(name) {
      return headers[name.toLowerCase()] ?? headers[name] ?? undefined;
    }
  };
}

test('normalizes valid HTTP origins and rejects opaque or unsafe values', () => {
  assert.equal(normalizeOrigin('https://bytejournal.example/path?q=1'), 'https://bytejournal.example');
  assert.equal(normalizeOrigin('http://localhost:80'), 'http://localhost');
  assert.equal(normalizeOrigin('null'), null);
  assert.equal(normalizeOrigin('javascript:alert(1)'), null);
  assert.equal(normalizeOrigin('not a URL'), null);
});

test('parses comma-separated frontend origins for split deployments', () => {
  const allowed = createAllowedOrigins('https://www.bytejournal.example, https://admin.bytejournal.example/path');
  assert.equal(allowed.size, 2);
  assert.equal(isCorsOriginAllowed('https://admin.bytejournal.example', allowed), true);
  assert.equal(isCorsOriginAllowed('https://attacker.example', allowed), false);
});

test('permits same-origin production requests through a reverse proxy', () => {
  const req = mockRequest({
    host: 'bytejournal.example',
    'x-forwarded-host': 'bytejournal.example',
    'x-forwarded-proto': 'https'
  }, 'http');
  const allowed = createAllowedOrigins('http://localhost:8080');
  assert.equal(getRequestOrigin(req), 'https://bytejournal.example');
  assert.equal(isTrustedRequestOrigin(req, 'https://bytejournal.example', allowed), true);
});

test('rejects foreign origins and explicitly cross-site requests without Origin', () => {
  const req = mockRequest({ host: 'bytejournal.example', 'sec-fetch-site': 'cross-site' }, 'https');
  const allowed = createAllowedOrigins('https://bytejournal.example');
  assert.equal(isTrustedRequestOrigin(req, 'https://attacker.example', allowed), false);
  assert.equal(isTrustedRequestOrigin(req, undefined, allowed), false);
});

test('allows configured split-origin requests even when API host differs', () => {
  const req = mockRequest({ host: 'api.bytejournal.example' }, 'https');
  const allowed = createAllowedOrigins('https://www.bytejournal.example');
  assert.equal(isTrustedRequestOrigin(req, 'https://www.bytejournal.example', allowed), true);
});

test('does not let a stale forwarded host mask the browser-facing Host header', () => {
  const req = mockRequest({
    host: 'www.bytejournal.example',
    'x-forwarded-host': 'internal-api.local:4000',
    'x-forwarded-proto': 'http',
    'sec-fetch-site': 'same-origin'
  }, 'http');
  const allowed = createAllowedOrigins('');
  assert.equal(isTrustedRequestOrigin(req, 'https://www.bytejournal.example', allowed), true);
});

test('accepts the public host when a TLS proxy omits the external protocol', () => {
  const req = mockRequest({
    host: 'www.bytejournal.example',
    'x-forwarded-host': 'internal-api.local:4000',
    'sec-fetch-site': 'same-origin'
  }, 'http');
  const allowed = createAllowedOrigins('');
  assert.equal(isTrustedRequestOrigin(req, 'https://www.bytejournal.example', allowed), true);
});

test('still rejects a cross-site origin even when it targets the same hostname over another scheme', () => {
  const req = mockRequest({
    host: 'www.bytejournal.example',
    'sec-fetch-site': 'cross-site'
  }, 'https');
  const allowed = createAllowedOrigins('');
  assert.equal(isTrustedRequestOrigin(req, 'http://www.bytejournal.example', allowed), false);
});
