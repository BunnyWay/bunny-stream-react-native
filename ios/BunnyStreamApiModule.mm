#import "BunnyStreamApiModule.h"

#import <React/RCTBridgeModule.h>
#import "BunnyStreamReactNative-Swift.h"

@implementation BunnyStreamApiModule

RCT_EXPORT_MODULE("BunnyStreamApi")

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeBunnyStreamApiSpecJSI>(params);
}

// MARK: - SDK status

- (NSNumber *)isInitialized
{
  return @([BunnyStreamApiModuleImpl.shared isInitialized]);
}

// MARK: - VideoRepository: reading

- (void)listVideos:(double)libraryId
              page:(double)page
      itemsPerPage:(double)itemsPerPage
            search:(NSString *)search
           orderBy:(NSString *)orderBy
      collectionId:(NSString *)collectionId
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] listVideosWithLibraryId:libraryId
                                                        page:page
                                                itemsPerPage:itemsPerPage
                                                      search:search
                                                     orderBy:orderBy
                                                collectionId:collectionId
                                                     resolve:resolve];
}

- (void)getVideo:(double)libraryId
         videoId:(NSString *)videoId
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] getVideoWithLibraryId:libraryId
                                                   videoId:videoId
                                                    resolve:resolve];
}

- (void)fetchVideoPlayData:(double)libraryId
                   videoId:(NSString *)videoId
                     token:(NSString *)token
                   expires:(NSNumber *)expires
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] fetchVideoPlayDataWithLibraryId:libraryId
                                                             videoId:videoId
                                                               token:token
                                                             expires:expires
                                                             resolve:resolve];
}

- (void)fetchVideoHeatmap:(double)libraryId
                    videoId:(NSString *)videoId
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] fetchVideoHeatmapWithLibraryId:libraryId
                                                            videoId:videoId
                                                            resolve:resolve];
}

- (void)fetchVideoStatistics:(double)libraryId
                     videoId:(NSString *)videoId
                    dateFrom:(NSString *)dateFrom
                      dateTo:(NSString *)dateTo
                      hourly:(BOOL)hourly
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] fetchVideoStatisticsWithLibraryId:libraryId
                                                               videoId:videoId
                                                              dateFrom:dateFrom
                                                                dateTo:dateTo
                                                                hourly:hourly
                                                               resolve:resolve];
}

- (void)fetchVideoResolutions:(double)libraryId
                      videoId:(NSString *)videoId
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] fetchVideoResolutionsWithLibraryId:libraryId
                                                                videoId:videoId
                                                                resolve:resolve];
}

// MARK: - VideoRepository: creating and changing

- (void)createVideo:(double)libraryId
            request:(NSDictionary *)request
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] createVideoWithLibraryId:libraryId
                                                      request:request
                                                      resolve:resolve];
}

- (void)updateVideo:(double)libraryId
            videoId:(NSString *)videoId
            request:(NSDictionary *)request
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] updateVideoWithLibraryId:libraryId
                                                      videoId:videoId
                                                      request:request
                                                      resolve:resolve];
}

- (void)deleteVideo:(double)libraryId
            videoId:(NSString *)videoId
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] deleteVideoWithLibraryId:libraryId
                                                      videoId:videoId
                                                      resolve:resolve];
}

// MARK: - CollectionRepository

- (void)listCollections:(double)libraryId
                   page:(double)page
           itemsPerPage:(double)itemsPerPage
                 search:(NSString *)search
                orderBy:(NSString *)orderBy
      includeThumbnails:(BOOL)includeThumbnails
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] listCollectionsWithLibraryId:libraryId
                                                             page:page
                                                     itemsPerPage:itemsPerPage
                                                           search:search
                                                          orderBy:orderBy
                                                includeThumbnails:includeThumbnails
                                                          resolve:resolve];
}

- (void)getCollection:(double)libraryId
         collectionId:(NSString *)collectionId
    includeThumbnails:(BOOL)includeThumbnails
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] getCollectionWithLibraryId:libraryId
                                                   collectionId:collectionId
                                              includeThumbnails:includeThumbnails
                                                        resolve:resolve];
}

- (void)createCollection:(double)libraryId
                    name:(NSString *)name
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] createCollectionWithLibraryId:libraryId
                                                              name:name
                                                           resolve:resolve];
}

- (void)updateCollection:(double)libraryId
            collectionId:(NSString *)collectionId
                    name:(NSString *)name
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] updateCollectionWithLibraryId:libraryId
                                                      collectionId:collectionId
                                                              name:name
                                                           resolve:resolve];
}

- (void)deleteCollection:(double)libraryId
            collectionId:(NSString *)collectionId
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] deleteCollectionWithLibraryId:libraryId
                                                      collectionId:collectionId
                                                           resolve:resolve];
}

// MARK: - LiveStreamRepository: reading

- (void)listLiveStreams:(double)libraryId
                   page:(NSNumber *)page
           itemsPerPage:(NSNumber *)itemsPerPage
                 search:(NSString *)search
                orderBy:(NSString *)orderBy
           collectionId:(NSString *)collectionId
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] listLiveStreamsWithLibraryId:libraryId
                                                             page:page
                                                     itemsPerPage:itemsPerPage
                                                           search:search
                                                          orderBy:orderBy
                                                     collectionId:collectionId
                                                          resolve:resolve];
}

- (void)getLiveStream:(double)libraryId
             streamId:(NSString *)streamId
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] getLiveStreamWithLibraryId:libraryId
                                                       streamId:streamId
                                                        resolve:resolve];
}

- (void)fetchLiveStreamPlayData:(double)libraryId
                       streamId:(NSString *)streamId
                          token:(NSString *)token
                        expires:(NSNumber *)expires
                        resolve:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] fetchLiveStreamPlayDataWithLibraryId:libraryId
                                                                 streamId:streamId
                                                                    token:token
                                                                  expires:expires
                                                                  resolve:resolve];
}

// MARK: - LiveStreamRepository: creating and changing

- (void)createLiveStream:(double)libraryId
                 request:(NSDictionary *)request
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] createLiveStreamWithLibraryId:libraryId
                                                           request:request
                                                           resolve:resolve];
}

- (void)updateLiveStream:(double)libraryId
                streamId:(NSString *)streamId
                 request:(NSDictionary *)request
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] updateLiveStreamWithLibraryId:libraryId
                                                           streamId:streamId
                                                           request:request
                                                           resolve:resolve];
}

- (void)deleteLiveStream:(double)libraryId
                streamId:(NSString *)streamId
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] deleteLiveStreamWithLibraryId:libraryId
                                                           streamId:streamId
                                                           resolve:resolve];
}

- (void)startLiveStream:(double)libraryId
               streamId:(NSString *)streamId
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] startLiveStreamWithLibraryId:libraryId
                                                          streamId:streamId
                                                           resolve:resolve];
}

- (void)stopLiveStream:(double)libraryId
              streamId:(NSString *)streamId
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] stopLiveStreamWithLibraryId:libraryId
                                                         streamId:streamId
                                                          resolve:resolve];
}

// MARK: - LiveStreamRepository: operational state and thumbnails

- (void)getLiveStreamStatus:(double)libraryId
                   streamId:(NSString *)streamId
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] getLiveStreamStatusWithLibraryId:libraryId
                                                             streamId:streamId
                                                              resolve:resolve];
}

- (void)setLiveStreamThumbnail:(double)libraryId
                      streamId:(NSString *)streamId
                  thumbnailUrl:(NSString *)thumbnailUrl
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] setLiveStreamThumbnailWithLibraryId:libraryId
                                                                streamId:streamId
                                                            thumbnailUrl:thumbnailUrl
                                                                 resolve:resolve];
}

- (void)uploadLiveStreamThumbnail:(double)libraryId
                         streamId:(NSString *)streamId
                              uri:(NSString *)uri
                      contentType:(NSString *)contentType
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] uploadLiveStreamThumbnailWithLibraryId:libraryId
                                                                   streamId:streamId
                                                                        uri:uri
                                                                contentType:contentType
                                                                    resolve:resolve];
}

- (void)listLiveStreamThumbnails:(double)libraryId
                        streamId:(NSString *)streamId
                           limit:(NSNumber *)limit
                            from:(NSString *)from
                              to:(NSString *)to
                         resolve:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] listLiveStreamThumbnailsWithLibraryId:libraryId
                                                                  streamId:streamId
                                                                     limit:limit
                                                                      from:from
                                                                        to:to
                                                                   resolve:resolve];
}

- (void)deleteLiveStreamThumbnail:(double)libraryId
                         streamId:(NSString *)streamId
            restoreLibraryDefault:(BOOL)restoreLibraryDefault
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] deleteLiveStreamThumbnailWithLibraryId:libraryId
                                                                   streamId:streamId
                                                      restoreLibraryDefault:restoreLibraryDefault
                                                                    resolve:resolve];
}

// MARK: - Player settings

- (void)fetchPlayerSettings:(double)libraryId
                    videoId:(NSString *)videoId
                      token:(NSString *)token
                    expires:(NSNumber *)expires
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamApiModuleImpl shared] fetchPlayerSettingsWithLibraryId:libraryId
                                                              videoId:videoId
                                                                token:token
                                                              expires:expires
                                                              resolve:resolve];
}

// MARK: - Token auth

- (NSString *)generateEmbedToken:(NSString *)tokenAuthKey
                         videoId:(NSString *)videoId
                         expires:(double)expires
{
  return [BunnyStreamApiModuleImpl.shared generateEmbedTokenWithTokenAuthKey:tokenAuthKey
                                                                     videoId:videoId
                                                                     expires:expires];
}

@end
