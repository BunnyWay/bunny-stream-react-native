/**
 * The seven error cases the SDK collapses every failure into.
 *
 * Mirrors the sealed class `net.bunny.api.error.BunnyError`. The `kind` string
 * is the bridge's discriminant — native maps each `BunnyError` subclass to one
 * of these so JS can pattern-match without `instanceof`.
 */
export type BunnyErrorKind =
  'Network' | 'Http' | 'Auth' | 'NotFound' | 'Decode' | 'LocalFile' | 'InvalidState';

/**
 * Typed error carried by {@link BunnyResult} when a call fails.
 *
 * `httpStatus` is `0` when no usable HTTP response existed (Network, Decode,
 * LocalFile, InvalidState). `isTerminal` is `true` for `401`/`403`/`404`/`410`
 * and for LocalFile/InvalidState — retrying can never succeed; everything else
 * (5xx, Network, Decode) is transient.
 */
export interface BunnyError {
  kind: BunnyErrorKind;
  httpStatus: number;
  message: string;
  isTerminal: boolean;
}

/**
 * The result envelope for the SDK's management calls: either `Ok` carrying the
 * value, or `Err` carrying a typed {@link BunnyError}.
 *
 * Mirrors `net.bunny.api.error.BunnyResult`. The bridge never throws — it
 * resolves the Promise with one of these two shapes so the caller can branch on
 * `result.ok` and keep the typed error.
 */
export type BunnyResult<T> = { ok: true; value: T } | { ok: false; error: BunnyError };
