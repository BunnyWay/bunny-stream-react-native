#import "BunnyStreamPlayerView.h"

#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTBridgeModule.h>
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
  std::shared_ptr<const BunnyStreamPlayerViewEventEmitter> _eventEmitter;
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

    // Wire the Swift impl's event closures to the Fabric event emitter.
    __weak __typeof__(self) weakSelf = self;

    _impl.onReady = ^(NSString *videoId, double durationMs) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onReady({
        .videoId = std::string([videoId UTF8String]),
        .durationMs = durationMs
      });
    };

    _impl.onPlaybackStateChange = ^(NSString *state, double positionMs) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onPlaybackStateChange({
        .state = std::string([state UTF8String]),
        .positionMs = positionMs
      });
    };

    _impl.onProgress = ^(double positionMs, double durationMs, double progress) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onProgress({
        .positionMs = positionMs,
        .durationMs = durationMs,
        .progress = progress
      });
    };

    _impl.onError = ^(NSString *code, NSString *message) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onError({
        .code = std::string([code UTF8String]),
        .message = std::string([message UTF8String])
      });
    };

    _impl.onBuffering = ^(BOOL isBuffering) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onBuffering({
        .isBuffering = (bool)isBuffering
      });
    };

    _impl.onPlay = ^(double positionMs, double durationMs) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onPlay({
        .positionMs = positionMs,
        .durationMs = durationMs
      });
    };

    _impl.onPause = ^(double positionMs, double durationMs) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onPause({
        .positionMs = positionMs,
        .durationMs = durationMs
      });
    };

    _impl.onEnd = ^(double positionMs, double durationMs) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onEnd({
        .positionMs = positionMs,
        .durationMs = durationMs
      });
    };

    _impl.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    self.clipsToBounds = YES;
    [self addSubview:_impl];
  }
  return self;
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  _impl.frame = self.bounds;
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
  // `super` applies `layoutMetrics.frame` (parent coordinate space) to `self`.
  // The impl is pinned to `self.bounds` in `layoutSubviews` — assigning the
  // parent-space frame here would offset it twice.
  [super updateLayoutMetrics:layoutMetrics oldLayoutMetrics:oldLayoutMetrics];
}

- (void)updateEventEmitter:(EventEmitter::Shared const &)eventEmitter
{
  [super updateEventEmitter:eventEmitter];
  _eventEmitter = std::static_pointer_cast<const BunnyStreamPlayerViewEventEmitter>(eventEmitter);
}

- (void)prepareForRecycle
{
  [_impl cleanup];
  _eventEmitter.reset();
  [super prepareForRecycle];
}

// MARK: - Commands (RCTBunnyStreamPlayerViewViewProtocol)

// Fabric dispatches view commands through `handleCommand:args:`. Without this
// override the Codegen-generated dispatcher is never invoked and every command
// sent from JS is silently dropped.
- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
  RCTBunnyStreamPlayerViewHandleCommand(self, commandName, args);
}

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
