import packageJson from '../../package.json';
import NativeBunnyStreamPlayer from '../specs/NativeBunnyStreamPlayer';
import { normalizeAccessKey, validateLibraryId } from './validation';

let configuredLibraryId: number | undefined;

export function getConfiguredLibraryId(): number | undefined {
  return configuredLibraryId;
}

/**
 * Initialises the Bunny Stream SDK with a library ID and optional API access key.
 *
 * Call this once during application startup before mounting a player or using
 * the management API. The access key only authorizes management calls — pass an
 * empty string (or `null`/`undefined`) for playback-only apps: public videos and
 * live streams play without credentials. Management/upload/broadcast features
 * report "not initialised" until a real key is provided.
 *
 * @throws {Error} If `libraryId` is not a positive integer.
 */
export function initialize(accessKey: string | null | undefined, libraryId: number): void {
  const key = normalizeAccessKey(accessKey);
  validateLibraryId(libraryId);
  NativeBunnyStreamPlayer.initialize(key, libraryId, packageJson.version);
  configuredLibraryId = libraryId;
}
