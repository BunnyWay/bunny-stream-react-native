import NativeBunnyStreamPlayer from '../specs/NativeBunnyStreamPlayer';
import { validateAccessKey, validateLibraryId } from './validation';

/**
 * Initialises the Bunny Stream SDK with an API access key and library ID.
 *
 * Call this once during application startup before mounting a player or using
 * the management API. SDK 4.0.0 requires a non-empty access key.
 *
 * @throws {Error} If `accessKey` is empty or `libraryId` is not a positive integer.
 */
export function initialize(accessKey: string, libraryId: number): void {
  validateAccessKey(accessKey);
  validateLibraryId(libraryId);
  NativeBunnyStreamPlayer.initialize(accessKey, libraryId);
}
