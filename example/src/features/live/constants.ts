import { LiveStreamStatusEnum } from '@bunny.net/stream-react-native';

import { colors } from '../../theme/colors';

/** Status pill color mapping — mirrors the Android demo's LiveStatusCard. */
export const LIVE_STATUS_COLORS: Record<string, string> = {
  [LiveStreamStatusEnum.RUNNING]: colors.live,
  [LiveStreamStatusEnum.SCHEDULED]: colors.primary,
  [LiveStreamStatusEnum.CREATED]: colors.neutral,
  [LiveStreamStatusEnum.PREVIEW]: colors.neutral,
  [LiveStreamStatusEnum.ENDED]: colors.neutralLight,
  [LiveStreamStatusEnum.VOD_PROCESSING]: colors.primary,
  [LiveStreamStatusEnum.ERROR]: colors.error,
  [LiveStreamStatusEnum.UNKNOWN]: colors.neutralLight,
};
