#import "BunnyLiveStreamPlayerView.h"

#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <react/renderer/components/BunnyStreamReactNativeSpec/ComponentDescriptors.h>
#import <react/renderer/components/BunnyStreamReactNativeSpec/EventEmitters.h>
#import <react/renderer/components/BunnyStreamReactNativeSpec/Props.h>
#import <react/renderer/components/BunnyStreamReactNativeSpec/RCTComponentViewHelpers.h>

#import "ReactTestApp-Swift.h"

using namespace facebook::react;

// Maps a lowercase state string to the Codegen enum.
static BunnyLiveStreamPlayerViewEventEmitter::OnLiveStateChangeState
liveStateFromString(const std::string &s)
{
  if (s == "loading") return BunnyLiveStreamPlayerViewEventEmitter::OnLiveStateChangeState::Loading;
  if (s == "offline") return BunnyLiveStreamPlayerViewEventEmitter::OnLiveStateChangeState::Offline;
  if (s == "countdown") return BunnyLiveStreamPlayerViewEventEmitter::OnLiveStateChangeState::Countdown;
  if (s == "trailer") return BunnyLiveStreamPlayerViewEventEmitter::OnLiveStateChangeState::Trailer;
  if (s == "live") return BunnyLiveStreamPlayerViewEventEmitter::OnLiveStateChangeState::Live;
  if (s == "vod") return BunnyLiveStreamPlayerViewEventEmitter::OnLiveStateChangeState::Vod;
  return BunnyLiveStreamPlayerViewEventEmitter::OnLiveStateChangeState::Loading;
}

@interface BunnyLiveStreamPlayerView () <RCTBunnyLiveStreamPlayerViewViewProtocol>
@end

@implementation BunnyLiveStreamPlayerView {
  BunnyLiveStreamPlayerViewImpl *_impl;
  BunnyLiveStreamPlayerViewEventEmitter::Shared _eventEmitter;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<BunnyLiveStreamPlayerViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const BunnyLiveStreamPlayerViewProps>();
    _props = defaultProps;
    _impl = [[BunnyLiveStreamPlayerViewImpl alloc] initWithFrame:frame];

    // Wire the Swift impl's closures to the Fabric event emitter.
    __weak __typeof__(self) weakSelf = self;
    _impl.onLiveStateChange = ^(NSString *state, BOOL isLive, NSString *reason,
                                NSNumber *targetEpochMs, NSString *title, BOOL dvrEnabled) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onLiveStateChange({
        .state = liveStateFromString(std::string([state UTF8String])),
        .isLive = (bool)isLive,
        .reason = reason ? std::string([reason UTF8String]) : "",
        .targetEpochMs = targetEpochMs ? [targetEpochMs doubleValue] : 0.0,
        .title = title ? std::string([title UTF8String]) : "",
        .dvrEnabled = (bool)dvrEnabled
      });
    };
    _impl.onLiveError = ^(NSString *message) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onLiveError({
        .message = std::string([message UTF8String])
      });
    };

    [self addSubview:_impl];
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newProps = *std::static_pointer_cast<BunnyLiveStreamPlayerViewProps const>(props);

  _impl.pendingLibraryId = (int)newProps.libraryId;
  _impl.pendingStreamId = [NSString stringWithUTF8String:newProps.streamId.c_str()];

  if (!newProps.token.empty()) {
    _impl.pendingToken = [NSString stringWithUTF8String:newProps.token.c_str()];
  } else {
    _impl.pendingToken = nil;
  }

  if (newProps.expires != 0.0) {
    _impl.pendingExpires = (int64_t)newProps.expires;
  } else {
    _impl.pendingExpires = nil;
  }

  _props = std::static_pointer_cast<Props const>(props);
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

- (void)updateEventEmitter:(EventEmitter::Shared const &)eventEmitter
{
  [super updateEventEmitter:eventEmitter];
  _eventEmitter = std::static_pointer_cast<BunnyLiveStreamPlayerViewEventEmitter const>(eventEmitter);
}

- (void)prepareForRecycle
{
  [_impl cleanup];
  _eventEmitter.reset();
  [super prepareForRecycle];
}

@end

// Register the component view with the Fabric plugin registry.
Class<RCTComponentViewProtocol> BunnyLiveStreamPlayerViewCls(void)
{
  return [BunnyLiveStreamPlayerView class];
}
