/** Origin policy shared by the API middleware and its unit tests. */
export function normalizeOrigin(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().toLowerCase() === 'null') return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function createAllowedOrigins(configuredOrigins = '') {
  return new Set(String(configuredOrigins).split(',').map(normalizeOrigin).filter(Boolean));
}

function firstHeaderValue(value) {
  return typeof value === 'string' ? value.split(',')[0].trim() : '';
}

function requestHosts(req) {
  return [
    firstHeaderValue(req.get?.('host')),
    firstHeaderValue(req.get?.('x-forwarded-host'))
  ].filter(Boolean).map(value => value.toLowerCase());
}

/**
 * Build every plausible public origin from the ordinary Host header and the
 * reverse-proxy headers. Some hosting panels rewrite one header but preserve
 * the other, so a bad forwarded header must not mask a correct Host header.
 */
export function getRequestOrigins(req) {
  const hosts = requestHosts(req);
  const protocols = [
    firstHeaderValue(req.get?.('x-forwarded-proto')),
    req.protocol
  ].filter(Boolean);
  const candidates = new Set();
  for (const host of hosts) {
    for (const protocol of protocols) {
      const normalized = normalizeOrigin(`${protocol}://${host}`);
      if (normalized) candidates.add(normalized);
    }
  }
  return candidates;
}

/** Retained as a convenience for diagnostics and compatibility. */
export function getRequestOrigin(req) {
  return [...getRequestOrigins(req)][0] || null;
}

export function isTrustedRequestOrigin(req, origin, allowedOrigins) {
  if (!origin) {
    // Non-browser clients commonly omit Origin. Reject an explicitly
    // cross-site browser request that omits it rather than trusting it.
    return req.get?.('sec-fetch-site') !== 'cross-site';
  }

  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (allowedOrigins.has(normalized) || getRequestOrigins(req).has(normalized)) return true;

  // TLS-terminating hosting proxies sometimes forward the public Host but
  // fail to forward the public scheme. For browser requests explicitly marked
  // same-origin, matching the exact Host is sufficient: the browser has
  // already established the scheme+host+port origin comparison. Do not apply
  // this fallback to cross-site or unknown Fetch Metadata requests.
  let originUrl;
  try { originUrl = new URL(normalized); } catch { return false; }
  const hostMatches = requestHosts(req).some(host => host === originUrl.host.toLowerCase());
  if (hostMatches && req.get?.('sec-fetch-site') === 'same-origin') return true;

  // Compatibility fallback for clients that send Referer but not Fetch
  // Metadata. Require both a matching Referer origin and exact request Host.
  const refererOrigin = normalizeOrigin(req.get?.('referer'));
  return hostMatches && refererOrigin === normalized;
}

export function isCorsOriginAllowed(origin, allowedOrigins) {
  const normalized = normalizeOrigin(origin);
  return Boolean(normalized && allowedOrigins.has(normalized));
}

export function getOriginDiagnostics(req, origin, allowedOrigins) {
  return {
    receivedOrigin: normalizeOrigin(origin),
    host: firstHeaderValue(req.get?.('host')) || null,
    forwardedHost: firstHeaderValue(req.get?.('x-forwarded-host')) || null,
    forwardedProto: firstHeaderValue(req.get?.('x-forwarded-proto')) || null,
    fetchSite: firstHeaderValue(req.get?.('sec-fetch-site')) || null,
    configuredOrigins: [...allowedOrigins]
  };
}
