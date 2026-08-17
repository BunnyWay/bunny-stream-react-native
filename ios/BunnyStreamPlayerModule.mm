#import "BunnyStreamPlayerModule.h"

@implementation BunnyStreamPlayerModule

RCT_EXPORT_MODULE()

- (void)initialize:(NSString *)accessKey libraryId:(double)libraryId {
  // TODO: iOS implementation — delegate to the native Bunny Stream SDK.
  // On Android this calls BunnyStreamApi.initialize(context, accessKey, libraryId).
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
