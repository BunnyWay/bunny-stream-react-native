#import "BunnyStreamUploadModule.h"

#import <React/RCTBridgeModule.h>
#import "BunnyStreamReactNative-Swift.h"

@implementation BunnyStreamUploadModule

RCT_EXPORT_MODULE("BunnyStreamUpload")

// Disabled observation lets `sendEventWithName` emit regardless of the
// listener counter — JS-side `NativeEventEmitter` delivers through
// `RCTDeviceEventEmitter` and simply drops events with no subscribers.
- (instancetype)init
{
  self = [super initWithDisabledObservation];
  if (self) {
    __weak BunnyStreamUploadModule *weakSelf = self;
    BunnyStreamUploadModuleImpl.shared.eventEmitter = ^(NSString *name, NSDictionary *body) {
      [weakSelf sendEventWithName:name body:body];
    };
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ BunnyStreamUploadModuleImpl.eventName ];
}

// A custom init would otherwise push module creation onto the main queue.
// This module does no UIKit work, so it can be created on any thread and
// avoids stalling the JS thread on a main-queue dispatch.
+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

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
