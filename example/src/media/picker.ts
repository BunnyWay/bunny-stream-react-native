import { launchImageLibrary, type Asset, type ImagePickerResponse } from 'react-native-image-picker';

/**
 * A picked media file ready to be handed to the Bunny Stream upload APIs.
 * `uri` is a local file URI (`file://` on iOS, `file://` or `content://` on
 * Android) accepted by `BunnyStreamUpload.startUpload` and
 * `BunnyStreamApi.uploadLiveStreamThumbnail`.
 */
export interface PickedFile {
  uri: string;
  fileName: string | null;
  fileSize: number | null;
  /** MIME type, e.g. `video/mp4` or `image/jpeg`. */
  mimeType: string | null;
}

/**
 * Opens the system media picker restricted to videos and returns the picked
 * files, or `null` when the user cancels.
 *
 * @param selectionLimit Max number of videos to pick (1 = single, 0 = unlimited).
 */
export async function pickVideo(selectionLimit = 1): Promise<PickedFile[] | null> {
  const response = await launchImageLibrary({
    mediaType: 'video',
    selectionLimit,
  });
  return mapResponse(response);
}

/**
 * Opens the system media picker restricted to a single image and returns the
 * picked file, or `null` when the user cancels.
 */
export async function pickImage(): Promise<PickedFile | null> {
  const response = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
  });
  const files = mapResponse(response);
  return files ? files[0] ?? null : null;
}

function mapResponse(response: ImagePickerResponse): PickedFile[] | null {
  if (response.didCancel) return null;
  if (response.errorCode || response.errorMessage) {
    throw new Error(response.errorMessage ?? response.errorCode ?? 'Image picker failed');
  }
  const assets = response.assets ?? [];
  if (assets.length === 0) return null;
  return assets.map(mapAsset).filter((f): f is PickedFile => f !== null);
}

function mapAsset(asset: Asset): PickedFile | null {
  if (!asset.uri) return null;
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? null,
    fileSize: asset.fileSize ?? null,
    mimeType: asset.type ?? null,
  };
}
