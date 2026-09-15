/**
 * The library's player configuration for one video, including any per-video
 * overrides. Mirrors `net.bunny.api.settings.domain.model.PlayerSettings`.
 *
 * Most callers want {@link BunnyStreamApi.fetchPlayerSettings} to enrich a
 * video list with thumbnail URLs — `thumbnailUrl` here is the CDN URL of the
 * video's current poster image.
 */
export interface PlayerSettings {
  thumbnailUrl: string;
  controls: string;
  keyColor: number;
  captionsFontSize: number;
  captionsFontColor: number | null;
  captionsBackgroundColor: number | null;
  uiLanguage: string;
  showHeatmap: boolean;
  fontFamily: string;
  playbackSpeeds: number[];
  drmEnabled: boolean;
  vastTagUrl: string | null;
  videoUrl: string;
  seekPath: string;
  captionsPath: string;
  resumePosition: number;
}
