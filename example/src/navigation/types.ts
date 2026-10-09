export type RootStackParamList = {
  Home: undefined;
  VideoList: undefined;
  VideoUpload: undefined;
  LiveStreams: {
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
  ThumbnailPicker: {
    libraryId: number;
    streamId: string;
  };
  Camera:
    { mode: 'new'; libraryId: number } | { mode: 'live'; libraryId: number; streamId: string };
  VideoManagement: { videoId: string; libraryId: number };
  ResumePositions: { libraryId: number };
  ResumeSettings: undefined;
};
