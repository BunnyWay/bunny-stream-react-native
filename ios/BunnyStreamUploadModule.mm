#import "BunnyStreamUploadModule.h"

#import <React/RCTBridgeModule.h>
#import "BunnyStreamReactNative-Swift.h"

@implementation BunnyStreamUploadModule

RCT_EXPORT_MODULE("BunnyStreamUpload")

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeBunnyStreamUploadSpecJSI>(params);
}

// MARK: - Upload lifecycle

- (void)startUpload:(double)libraryId
               uri:(NSString *)uri
             title:(NSString *)title
      collectionId:(NSString *)collectionId
              mode:(NSString *)mode
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamUploadModuleImpl shared] startUploadWithLibraryId:libraryId
                                                             uri:uri
                                                           title:title
                                                    collectionId:collectionId
                                                            mode:mode
                                                         resolve:resolve];
}

- (void)continueUpload:(double)libraryId
              videoId:(NSString *)videoId
                  uri:(NSString *)uri
                 mode:(NSString *)mode
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamUploadModuleImpl shared] continueUploadWithLibraryId:libraryId
                                                             videoId:videoId
                                                                 uri:uri
                                                                mode:mode
                                                             resolve:resolve];
}

- (void)pauseUpload:(NSString *)uploadId
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamUploadModuleImpl shared] pauseUploadWithUploadId:uploadId resolve:resolve];
}

- (void)resumeUpload:(NSString *)uploadId
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamUploadModuleImpl shared] resumeUploadWithUploadId:uploadId resolve:resolve];
}

- (void)cancelUpload:(NSString *)uploadId
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamUploadModuleImpl shared] cancelUploadWithUploadId:uploadId resolve:resolve];
}

- (void)getUploadState:(NSString *)uploadId
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [[BunnyStreamUploadModuleImpl shared] getUploadStateWithUploadId:uploadId resolve:resolve];
}

- (void)restoreUploads
{
  [[BunnyStreamUploadModuleImpl shared] restoreUploads];
}

// MARK: - Event emitter stubs

- (void)addListener:(NSString *)eventName
{
  [[BunnyStreamUploadModuleImpl shared] addListener:eventName];
}

- (void)removeListeners:(double)count
{
  [[BunnyStreamUploadModuleImpl shared] removeListeners:count];
}

@end
