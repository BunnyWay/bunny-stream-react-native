import { LiveStreamStatusEnum } from 'bunny-stream-react-native';

import { colors } from '../../theme/colors';

/** Status pill color mapping — mirrors the Android demo's LiveStatusCard. */
export const LIVE_STATUS_COLORS: Record<string, string> = {
  [LiveStreamStatusEnum.RUNNING]: '#e53935',
  [LiveStreamStatusEnum.SCHEDULED]: colors.primary,
  [LiveStreamStatusEnum.CREATED]: '#888',
  [LiveStreamStatusEnum.PREVIEW]: '#888',
  [LiveStreamStatusEnum.ENDED]: '#aaa',
  [LiveStreamStatusEnum.VOD_PROCESSING]: colors.primary,
  [LiveStreamStatusEnum.ERROR]: '#d32f2f',
  [LiveStreamStatusEnum.UNKNOWN]: '#aaa',
};
