#import "BunnyStreamPlayerModule.h"

#import "ReactTestApp-Swift.h"

@implementation BunnyStreamPlayerModule

RCT_EXPORT_MODULE()

- (void)initialize:(NSString *)accessKey libraryId:(double)libraryId
{
  if (accessKey.length == 0) {
    @throw [NSException exceptionWithName:@"InvalidArgumentException"
                                   reason:@"accessKey must be a non-empty string"
                                 userInfo:nil];
  }
  if (!isfinite(libraryId) || libraryId <= 0 || libraryId != floor(libraryId)) {
    @throw [NSException exceptionWithName:@"InvalidArgumentException"
                                   reason:@"libraryId must be a positive integer"
                                 userInfo:nil];
  }

  // Store the configuration in the bridge-owned configuration store.
  // Fabric views read it when creating a BunnyStreamPlayer / BunnyStreamLivePlayer.
  // This mirrors Android's BunnyStreamApi.initialize(context, accessKey, libraryId)
  // without requiring a global SDK init (Plan-iOS.md §13.1).
  dispatch_async(dispatch_get_main_queue(), ^{
    [[BunnyStreamConfiguration shared] configureWithAccessKey:accessKey
                                                    libraryId:(int)libraryId];
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeBunnyStreamPlayerSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"BunnyStreamPlayer";
}

@end
