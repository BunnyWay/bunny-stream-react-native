import type { BunnyError, BunnyResult } from './BunnyResult';

/**
 * The value when this is `Ok`, `null` otherwise. Mirrors `BunnyResult.getOrNull`.
 */
export function getOrNull<T>(result: BunnyResult<T>): T | null {
  return result.ok ? result.value : null;
}

/**
 * The error when this is `Err`, `null` otherwise. Mirrors `BunnyResult.errorOrNull`.
 */
export function errorOrNull<T>(result: BunnyResult<T>): BunnyError | null {
  return result.ok ? null : result.error;
}

/**
 * Collapses the result into a single value by applying the matching side.
 * Mirrors `BunnyResult.fold`.
 */
export function fold<T, R>(
  result: BunnyResult<T>,
  onOk: (value: T) => R,
  onErr: (error: BunnyError) => R,
): R {
  return result.ok ? onOk(result.value) : onErr(result.error);
}

/**
 * Transforms the value of an `Ok` result; an `Err` passes through unchanged.
 * Mirrors `BunnyResult.map`.
 */
export function map<T, R>(result: BunnyResult<T>, transform: (value: T) => R): BunnyResult<R> {
  return result.ok ? { ok: true, value: transform(result.value) } : result;
}
