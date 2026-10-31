/**
 * The providers' one way out: a GET that answers with the body or null, never
 * an exception. They are raced against each other, so the deadline is short.
 *
 * Runs inside Cider's web view, so the browser's CORS rules apply: a host that
 * sends no CORS headers (KuGou, Musixmatch, Genius) simply misses, and
 * `blocked` collects those hosts for the settings page.
 */

const DIRECT_TIMEOUT_MS = 6000;
const PATIENT_TIMEOUT_MS = 15_000;

/** Hosts a request failed for with a network-level error (usually CORS). */
export const blockedHosts = new Set<string>();

export interface GetOptions {
  headers?: Record<string, string>;
  /** Longer deadline for authenticated routes that look things up upstream (PaxSenix). */
  patient?: boolean;
  /** Accepted for provider compatibility; there is no other route in Cider. */
  route?: 'direct' | 'extension';
}

export async function lyricsGet(url: string, { headers, patient }: GetOptions = {}): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json, text/plain, */*', ...headers },
      signal: AbortSignal.timeout(patient ? PATIENT_TIMEOUT_MS : DIRECT_TIMEOUT_MS),
      referrerPolicy: 'no-referrer',
    });
    return response.ok ? await response.text() : null;
  } catch (error) {
    if (error instanceof TypeError) blockedHosts.add(new URL(url).host);
    return null;
  }
}

/** A URL with query parameters, skipping empty ones. */
export function urlWith(base: string, params: Record<string, string | number | null | undefined>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}
