export type RootStackParamList = {
  Home: undefined;
  VideoList: undefined;
  Settings: undefined;
  Player: { videoId: string; libraryId: number };
  PlayerCustom: { videoId: string; libraryId: number };
};
