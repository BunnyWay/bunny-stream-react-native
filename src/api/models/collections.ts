/** A named grouping of videos in a Bunny Stream library. */
export interface VideoCollection {
  id: string;
  videoLibraryId: number;
  name: string;
  videoCount: number;
  totalSizeBytes: number;
  previewVideoIds: string[];
  previewImageUrls: string[];
}

/** Paginated collection listing. */
export interface VideoCollectionList {
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  items: VideoCollection[];
}

/** Filtering and thumbnail options for {@link BunnyStreamApi.listCollections}. */
export interface CollectionListOptions {
  page?: number;
  itemsPerPage?: number;
  search?: string;
  orderBy?: string;
  includeThumbnails?: boolean;
}
