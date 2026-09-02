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
