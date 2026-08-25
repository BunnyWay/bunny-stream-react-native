#import "BunnyStreamPlayerView.h"

#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <react/renderer/components/BunnyStreamReactNativeSpec/ComponentDescriptors.h>
#import <react/renderer/components/BunnyStreamReactNativeSpec/EventEmitters.h>
#import <react/renderer/components/BunnyStreamReactNativeSpec/Props.h>
#import <react/renderer/components/BunnyStreamReactNativeSpec/RCTComponentViewHelpers.h>

#import "BunnyStreamReactNative-Swift.h"

using namespace facebook::react;

@interface BunnyStreamPlayerView () <RCTBunnyStreamPlayerViewViewProtocol>
@end

@implementation BunnyStreamPlayerView {
  BunnyStreamPlayerViewImpl *_impl;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<BunnyStreamPlayerViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const BunnyStreamPlayerViewProps>();
    _props = defaultProps;
    _impl = [[BunnyStreamPlayerViewImpl alloc] initWithFrame:frame];
    [self addSubview:_impl];
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newProps = *std::static_pointer_cast<BunnyStreamPlayerViewProps const>(props);

  _impl.pendingVideoId = [NSString stringWithUTF8String:newProps.videoId.c_str()] ?: @"";
  _impl.pendingLibraryId = (int)newProps.libraryId;

  if (!newProps.token.empty()) {
    _impl.pendingToken = [NSString stringWithUTF8String:newProps.token.c_str()];
  } else {
    _impl.pendingToken = nil;
  }

  // expires: 0.0 means "not set" per Codegen Double? default
  if (newProps.expires != 0.0) {
    _impl.pendingExpires = @(newProps.expires);
  } else {
    _impl.pendingExpires = nil;
  }

  _impl.pendingAutoPlay = newProps.autoPlay;
  _impl.pendingControls = newProps.controls;

  [super updateProps:props oldProps:oldProps];
}

- (void)finalizeUpdates:(RNComponentViewUpdateMask)updateMask
{
  [super finalizeUpdates:updateMask];
  [_impl commitProps];
}

- (void)updateLayoutMetrics:(LayoutMetrics const &)layoutMetrics
                       oldLayoutMetrics:(LayoutMetrics const &)oldLayoutMetrics
{
  [super updateLayoutMetrics:layoutMetrics oldLayoutMetrics:oldLayoutMetrics];
  _impl.frame = RCTCGRectFromRect(layoutMetrics.frame);
}

- (void)prepareForRecycle
{
  [_impl cleanup];
  [super prepareForRecycle];
}

// MARK: - Commands (RCTBunnyStreamPlayerViewViewProtocol)

- (void)play
{
  [_impl play];
}

- (void)pause
{
  [_impl pause];
}

- (void)seekTo:(double)positionMs
{
  [_impl seekToPositionMs:positionMs];
}

- (void)setVolume:(double)volume
{
  [_impl setVolumeWithVolume:volume];
}

- (void)setPlaybackRate:(double)rate
{
  [_impl setPlaybackRateWithRate:rate];
}

- (void)mute
{
  [_impl mute];
}

- (void)unmute
{
  [_impl unmute];
}

@end

// Register the component view with the Fabric plugin registry.
Class<RCTComponentViewProtocol> BunnyStreamPlayerViewCls(void)
{
  return [BunnyStreamPlayerView class];
}
