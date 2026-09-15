#import "BunnyStreamBroadcasterView.h"

#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTBridgeModule.h>
#import <react/renderer/components/BunnyStreamReactNativeSpec/ComponentDescriptors.h>
#import <react/renderer/components/BunnyStreamReactNativeSpec/EventEmitters.h>
#import <react/renderer/components/BunnyStreamReactNativeSpec/Props.h>
#import <react/renderer/components/BunnyStreamReactNativeSpec/RCTComponentViewHelpers.h>

#import "BunnyStreamReactNative-Swift.h"

using namespace facebook::react;

@interface BunnyStreamBroadcasterView () <RCTBunnyStreamBroadcasterViewViewProtocol>
@end

@implementation BunnyStreamBroadcasterView {
  BunnyStreamBroadcasterViewImpl *_impl;
  std::shared_ptr<const BunnyStreamBroadcasterViewEventEmitter> _eventEmitter;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<BunnyStreamBroadcasterViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const BunnyStreamBroadcasterViewProps>();
    _props = defaultProps;
    _impl = [[BunnyStreamBroadcasterViewImpl alloc] initWithFrame:frame];

    // Wire the Swift impl's closures to the Fabric event emitter.
    __weak __typeof__(self) weakSelf = self;

    _impl.onStateChange = ^(NSString *state) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      auto s = std::string([state UTF8String]);
      BunnyStreamBroadcasterViewEventEmitter::OnStateChangeState stateEnum;
      if (s == "idle") stateEnum = BunnyStreamBroadcasterViewEventEmitter::OnStateChangeState::Idle;
      else if (s == "preparing") stateEnum = BunnyStreamBroadcasterViewEventEmitter::OnStateChangeState::Preparing;
      else if (s == "live") stateEnum = BunnyStreamBroadcasterViewEventEmitter::OnStateChangeState::Live;
      else stateEnum = BunnyStreamBroadcasterViewEventEmitter::OnStateChangeState::Idle;
      strongSelf->_eventEmitter->onStateChange({.state = stateEnum});
    };

    _impl.onElapsedTime = ^(NSInteger elapsedMs, NSString *formatted) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onElapsedTime({
        .elapsedMs = (int)elapsedMs,
        .formatted = std::string([formatted UTF8String])
      });
    };

    _impl.onCameraChange = ^(NSString *position) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      auto p = std::string([position UTF8String]);
      BunnyStreamBroadcasterViewEventEmitter::OnCameraChangePosition posEnum;
      if (p == "front") posEnum = BunnyStreamBroadcasterViewEventEmitter::OnCameraChangePosition::Front;
      else posEnum = BunnyStreamBroadcasterViewEventEmitter::OnCameraChangePosition::Back;
      strongSelf->_eventEmitter->onCameraChange({.position = posEnum});
    };

    _impl.onMuteChange = ^(BOOL muted) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onMuteChange({.muted = (bool)muted});
    };

    _impl.onIngestStateChange = ^(NSString *endpoint, NSString *state) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      auto e = std::string([endpoint UTF8String]);
      auto s = std::string([state UTF8String]);
      BunnyStreamBroadcasterViewEventEmitter::OnIngestStateChangeEndpoint endpointEnum;
      if (e == "primary") endpointEnum = BunnyStreamBroadcasterViewEventEmitter::OnIngestStateChangeEndpoint::Primary;
      else endpointEnum = BunnyStreamBroadcasterViewEventEmitter::OnIngestStateChangeEndpoint::Backup;
      BunnyStreamBroadcasterViewEventEmitter::OnIngestStateChangeState stateEnum;
      if (s == "connecting") stateEnum = BunnyStreamBroadcasterViewEventEmitter::OnIngestStateChangeState::Connecting;
      else if (s == "live") stateEnum = BunnyStreamBroadcasterViewEventEmitter::OnIngestStateChangeState::Live;
      else stateEnum = BunnyStreamBroadcasterViewEventEmitter::OnIngestStateChangeState::Offline;
      strongSelf->_eventEmitter->onIngestStateChange({
        .endpoint = endpointEnum,
        .state = stateEnum
      });
    };

    _impl.onReconnecting = ^(NSInteger attempt, BOOL usingBackup) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onReconnecting({
        .attempt = (int)attempt,
        .usingBackup = (bool)usingBackup
      });
    };

    _impl.onReconnectFailed = ^{
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onReconnectFailed({.failed = true});
    };

    _impl.onFailover = ^(BOOL usingBackup) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onFailover({.usingBackup = (bool)usingBackup});
    };

    _impl.onError = ^(NSString *message) {
      __strong __typeof__(weakSelf) strongSelf = weakSelf;
      if (!strongSelf || !strongSelf->_eventEmitter) return;
      strongSelf->_eventEmitter->onError({
        .message = std::string([message UTF8String])
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
  const auto &newProps = *std::static_pointer_cast<BunnyStreamBroadcasterViewProps const>(props);

  _impl.pendingAccessKey = [NSString stringWithUTF8String:newProps.accessKey.c_str()];
  _impl.pendingLibraryId = (int)newProps.libraryId;

  if (!newProps.streamId.empty()) {
    _impl.pendingStreamId = [NSString stringWithUTF8String:newProps.streamId.c_str()];
  } else {
    _impl.pendingStreamId = nil;
  }

  if (!newProps.ingestEndpoint.empty()) {
    _impl.pendingIngestEndpoint = [NSString stringWithUTF8String:newProps.ingestEndpoint.c_str()];
  } else {
    _impl.pendingIngestEndpoint = nil;
  }

  if (!newProps.quality.empty()) {
    _impl.pendingQualityJson = [NSString stringWithUTF8String:newProps.quality.c_str()];
  } else {
    _impl.pendingQualityJson = nil;
  }

  if (!newProps.cameraPosition.empty()) {
    _impl.pendingCameraPosition = [NSString stringWithUTF8String:newProps.cameraPosition.c_str()];
  }

  _impl.pendingHideDefaultControls = newProps.hideDefaultControls;
  _impl.pendingDualPublish = newProps.dualPublish;
  _impl.pendingAutoStart = newProps.autoStart;

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
}

- (void)updateEventEmitter:(EventEmitter::Shared const &)eventEmitter
{
  [super updateEventEmitter:eventEmitter];
  _eventEmitter = std::static_pointer_cast<const BunnyStreamBroadcasterViewEventEmitter>(eventEmitter);
}

- (void)prepareForRecycle
{
  [_impl cleanup];
  _eventEmitter.reset();
  [super prepareForRecycle];
}

// MARK: - Commands (RCTBunnyStreamBroadcasterViewViewProtocol)

// Fabric dispatches view commands through `handleCommand:args:`. Without this
// override the Codegen-generated dispatcher is never invoked and every command
// sent from JS is silently dropped.
- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
  RCTBunnyStreamBroadcasterViewHandleCommand(self, commandName, args);
}

- (void)startBroadcast
{
  [_impl startBroadcast];
}

- (void)stopBroadcast
{
  [_impl stopBroadcast];
}

- (void)switchCamera
{
  [_impl switchCamera];
}

- (void)setMuted:(BOOL)muted
{
  [_impl setMuted:muted];
}

- (void)toggleMute
{
  [_impl toggleMute];
}

@end

// Register the component view with the Fabric plugin registry.
Class<RCTComponentViewProtocol> BunnyStreamBroadcasterViewCls(void)
{
  return BunnyStreamBroadcasterView.class;
}
