export type RootStackParamList = {
  Home: undefined;
  VideoList: undefined;
  VideoUpload: undefined;
  LiveStreams: {
    /** Handed back from TrailerPickerScreen; consumed by the editor modal. */
    pickedTrailerVideoId?: string;
    /** Handed back from ThumbnailPickerScreen; consumed by the editor modal. */
    pickedThumbnailUrl?: string;
  };
  Settings: undefined;
  Player: { videoId: string; libraryId: number };
  LivePlayer: {
    streamId: string;
    libraryId: number;
    token?: string;
    expires?: number;
  };
  TrailerPicker: {
    libraryId: number;
  };
  ThumbnailPicker: {
    libraryId: number;
    streamId: string;
  };
};
