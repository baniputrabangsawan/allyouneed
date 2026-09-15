/**
 * DNS-AID cannot be served by this app. Publish these records on usekits.online
 * (Cloudflare DNS) and enable DNSSEC. Scanners look up `_index._agents` and
 * `_a2a._agents` as HTTPS/SVCB, not HTTP.
 */
export const DNS_AID_RECORDS = [
  '_index._agents 300 IN HTTPS 1 . alpn="h2,h3"',
  '_a2a._agents 300 IN HTTPS 1 . alpn="h2,h3"',
] as const
