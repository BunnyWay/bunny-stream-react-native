import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { LiveStream, UploadEvent } from 'bunny-stream-react-native';

import * as React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BunnyStreamApi, BunnyStreamUpload, fold } from 'bunny-stream-react-native';

import { BunnyThumbnail } from '../../components/BunnyThumbnail';
import { OutlineButton } from '../../components/OutlineButton';
import { ProgressBar } from '../../components/ProgressBar';
import { StatusBanner } from '../../components/StatusBanner';
import { ToggleRow } from '../../components/ToggleRow';
import { pickImage, pickVideo } from '../../media/picker';
import { colors } from '../../theme/colors';
import { formatHms, parseHms, updateRtmpRow, validateHms } from './time';

/**
 * Live stream editor modal — mirrors the Android demo's
 * LiveStreamEditorScreen. Used for both create (stream=null) and edit
 * (stream=<existing>) flows. Fields are grouped into sections:
 *   Details (title, description, public, record VOD)
 *   Schedule (enable, start, end, countdown)
 *   DVR (enable, timeframe)
 *   Pre-stream trailer (enable, video ID)
 *   Thumbnail (enable, image URL)
 *   RTMP outputs (up to 4 rows of endpoint + stream key)
 *
 * Only `title` is required. On success, calls `onDone` which closes
 * the modal and refreshes the list.
 */
export function LiveStreamEditorModal({
  visible,
  libraryId,
  stream,
  navigation,
  pickedTrailerVideoId,
  pickedThumbnailUrl,
  onConsumePickedTrailer,
  onConsumePickedThumbnail,
  onClose,
  onDone,
}: {
  visible: boolean;
  libraryId: number | null;
  stream: LiveStream | null;
  navigation: NativeStackNavigationProp<RootStackParamList, 'LiveStreams'>;
  pickedTrailerVideoId: string | null;
  pickedThumbnailUrl: string | null;
  onConsumePickedTrailer: () => void;
  onConsumePickedThumbnail: () => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const isEdit = stream != null;
  // Details
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isPublic, setIsPublic] = React.useState(true);
  const [recordVod, setRecordVod] = React.useState(false);

  // Schedule
  const [scheduleEnabled, setScheduleEnabled] = React.useState(false);
  const [scheduledStart, setScheduledStart] = React.useState('');
  const [scheduledEnd, setScheduledEnd] = React.useState('');
  const [enableCountdown, setEnableCountdown] = React.useState(false);

  // DVR
  const [dvrEnabled, setDvrEnabled] = React.useState(false);
  const [dvrWindow, setDvrWindow] = React.useState('12:00:00');

  // Trailer
  const [trailerEnabled, setTrailerEnabled] = React.useState(false);
  const [trailerVideoId, setTrailerVideoId] = React.useState('');
  // In-progress trailer upload (basic uploader, like native demo apps).
  const [trailerUpload, setTrailerUpload] = React.useState<{
    uploadId: string;
    progress: number;
    status: 'uploading' | 'failed';
    error: string | null;
  } | null>(null);

  // Thumbnail
  const [thumbnailEnabled, setThumbnailEnabled] = React.useState(false);
  const [thumbnailUrl, setThumbnailUrl] = React.useState('');
  // Local image URI from the system picker — uploaded after the stream exists.
  const [thumbnailLocalUri, setThumbnailLocalUri] = React.useState<string | null>(null);

  // RTMP outputs
  const [rtmpOutputs, setRtmpOutputs] = React.useState<{ url: string; key: string }[]>([]);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const MAX_RTMP = 4;

  // Apply a trailer picked from the library picker screen.
  React.useEffect(() => {
    if (pickedTrailerVideoId) {
      setTrailerEnabled(true);
      setTrailerVideoId(pickedTrailerVideoId);
      onConsumePickedTrailer();
    }
  }, [pickedTrailerVideoId, onConsumePickedTrailer]);

  // Apply a thumbnail URL picked from the generated-thumbnails picker screen.
  React.useEffect(() => {
    if (pickedThumbnailUrl) {
      setThumbnailEnabled(true);
      setThumbnailUrl(pickedThumbnailUrl);
      setThumbnailLocalUri(null);
      onConsumePickedThumbnail();
    }
  }, [pickedThumbnailUrl, onConsumePickedThumbnail]);

  // Subscribe to upload events while the modal is open, to drive the trailer
  // upload progress row. Only the trailer upload is tracked here (library
  // uploads live on the VideoUpload screen).
  React.useEffect(() => {
    if (!visible) return;
    const unsubscribe = BunnyStreamUpload.addUploadListener((event: UploadEvent) => {
      setTrailerUpload((current) => {
        if (!current || event.uploadId !== current.uploadId) return current;
        switch (event.type) {
          case 'progress':
            return { ...current, progress: event.progress, status: 'uploading' };
          case 'completed':
            setTrailerVideoId(event.videoId);
            setTrailerEnabled(true);
            return null;
          case 'failed':
            return { ...current, status: 'failed', error: event.error.message };
          case 'cancelled':
            return null;
          default:
            return current;
        }
      });
    });
    return unsubscribe;
  }, [visible]);

  const handleUploadTrailer = async () => {
    if (libraryId == null) return;
    setError(null);
    try {
      const picked = await pickVideo(1);
      if (!picked || picked.length === 0) return;
      const file = picked[0];
      const result = await BunnyStreamUpload.startUpload({
        libraryId,
        uri: file.uri,
        title: file.fileName ?? undefined,
        mode: 'basic',
      });
      fold(
        result,
        (handle) => {
          setTrailerUpload({
            uploadId: handle.uploadId,
            progress: 0,
            status: 'uploading',
            error: null,
          });
        },
        (err) => setError(err.message),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handlePickThumbnailPhoto = async () => {
    setError(null);
    try {
      const picked = await pickImage();
      if (!picked) return;
      setThumbnailLocalUri(picked.uri);
      setThumbnailUrl('');
      setThumbnailEnabled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleChooseTrailerFromLibrary = () => {
    if (libraryId == null) return;
    navigation.navigate('TrailerPicker', { libraryId });
  };

  const handleBrowseThumbnails = () => {
    if (libraryId == null || stream == null) return;
    navigation.navigate('ThumbnailPicker', { libraryId, streamId: stream.id });
  };

  // Reset/prefill form when modal opens
  React.useEffect(() => {
    if (visible) {
      if (stream) {
        setTitle(stream.title);
        setDescription(stream.description ?? '');
        setIsPublic(stream.isPublic);
        setRecordVod(stream.recordVod);
        const hasSchedule = stream.scheduledStartTime != null || stream.scheduledEndTime != null;
        setScheduleEnabled(hasSchedule);
        setScheduledStart(stream.scheduledStartTime ?? '');
        setScheduledEnd(stream.scheduledEndTime ?? '');
        setEnableCountdown(stream.enableCountdown ?? false);
        setDvrEnabled(stream.dvrEnabled);
        setDvrWindow(stream.dvrWindowSeconds ? formatHms(stream.dvrWindowSeconds) : '12:00:00');
        const hasTrailer = stream.preStreamTrailerVideoId != null;
        setTrailerEnabled(hasTrailer);
        setTrailerVideoId(stream.preStreamTrailerVideoId ?? '');
        setThumbnailEnabled(false);
        setThumbnailUrl('');
        setRtmpOutputs(
          (stream.rtmpOutputs ?? []).map((o) => ({
            url: o.endpoint ?? '',
            key: o.streamKey ?? '',
          })),
        );
      } else {
        setTitle('');
        setDescription('');
        setIsPublic(true);
        setRecordVod(false);
        setScheduleEnabled(false);
        setScheduledStart('');
        setScheduledEnd('');
        setEnableCountdown(false);
        setDvrEnabled(false);
        setDvrWindow('12:00:00');
        setTrailerEnabled(false);
        setTrailerVideoId('');
        setThumbnailEnabled(false);
        setThumbnailUrl('');
        setThumbnailLocalUri(null);
        setTrailerUpload(null);
        setRtmpOutputs([]);
      }
      setSaving(false);
      setError(null);
    }
  }, [visible, stream]);

  const dvrWindowError = dvrEnabled ? validateHms(dvrWindow) : null;
  const canSubmit = title.trim().length > 0 && !saving && libraryId != null && !dvrWindowError;

  const handleSave = async () => {
    if (!canSubmit || libraryId == null) return;
    setSaving(true);
    setError(null);

    const rtmp = rtmpOutputs
      .map((o) => ({ endpoint: o.url.trim(), streamKey: o.key.trim() || null }))
      .filter((o) => o.endpoint.length > 0);
    const dvrSeconds = dvrEnabled ? parseHms(dvrWindow) : null;

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      isPublic,
      recordVod,
      scheduledStartTime: scheduleEnabled && scheduledStart.trim() ? scheduledStart.trim() : null,
      scheduledEndTime: scheduleEnabled && scheduledEnd.trim() ? scheduledEnd.trim() : null,
      enableCountdown: scheduleEnabled ? enableCountdown : null,
      dvrEnabled,
      dvrWindowSeconds: dvrSeconds,
      preStreamTrailerVideoId:
        trailerEnabled && trailerVideoId.trim() ? trailerVideoId.trim() : null,
      rtmpOutputs: rtmp.length > 0 ? rtmp : null,
    };

    // Phase 1: create or update the live stream record.
    let resolvedStreamId: string | null = null;
    if (isEdit && stream) {
      const result = await BunnyStreamApi.updateLiveStream(libraryId, stream.id, payload);
      if (!result.ok) {
        setError(result.error.message);
        setSaving(false);
        return;
      }
      resolvedStreamId = stream.id;
    } else {
      const result = await BunnyStreamApi.createLiveStream(libraryId, payload);
      if (!result.ok) {
        setError(result.error.message);
        setSaving(false);
        return;
      }
      resolvedStreamId = result.value.id;
    }

    if (resolvedStreamId == null) {
      // Stream saved but we couldn't resolve an id for the thumbnail step —
      // treat as success and let the list refresh surface the stream.
      onDone();
      return;
    }

    // Phase 2: apply the thumbnail. The thumbnail endpoints require a
    // streamId, so this runs after the stream exists. Mirrors the native
    // demo apps' two-phase save.
    const thumbError = await applyThumbnail(resolvedStreamId);
    if (thumbError) {
      setError(thumbError);
      setSaving(false);
      return;
    }

    onDone();
  };

  /**
   * Applies the thumbnail selection to an existing stream. Returns an error
   * message on failure, or null on success / no-op.
   *
   * - Local image (from Photos) → `uploadLiveStreamThumbnail`
   * - Remote URL → `setLiveStreamThumbnail`
   * - Thumbnail disabled while editing and a thumbnail existed → `deleteLiveStreamThumbnail`
   */
  const applyThumbnail = async (streamId: string): Promise<string | null> => {
    if (libraryId == null) return null;

    if (thumbnailEnabled) {
      if (thumbnailLocalUri) {
        const result = await BunnyStreamApi.uploadLiveStreamThumbnail(
          libraryId,
          streamId,
          thumbnailLocalUri,
        );
        return result.ok ? null : result.error.message;
      }
      const trimmed = thumbnailUrl.trim();
      if (trimmed) {
        const result = await BunnyStreamApi.setLiveStreamThumbnail(libraryId, streamId, trimmed);
        return result.ok ? null : result.error.message;
      }
      return null;
    }

    // Thumbnail disabled. When editing a stream that had a thumbnail, clear it.
    if (isEdit && stream && stream.thumbnailFileName) {
      const result = await BunnyStreamApi.deleteLiveStreamThumbnail(libraryId, streamId);
      return result.ok ? null : result.error.message;
    }
    return null;
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[createStyles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={createStyles.header}>
          <TouchableOpacity onPress={onClose} disabled={saving}>
            <Text style={[createStyles.cancelButton, saving && createStyles.textDisabled]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text style={createStyles.headerTitle}>
            {isEdit ? 'Edit live stream' : 'New live stream'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={!canSubmit}>
            <Text style={[createStyles.saveButton, !canSubmit && createStyles.textDisabled]}>
              {saving ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={createStyles.scroll} contentContainerStyle={createStyles.scrollContent}>
          {/* Details section */}
          <Text style={createStyles.sectionTitle}>Details</Text>

          <Text style={createStyles.label}>Title *</Text>
          <TextInput
            style={createStyles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Stream title"
            placeholderTextColor="#999"
          />

          <Text style={createStyles.label}>Description</Text>
          <TextInput
            style={[createStyles.input, createStyles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional description"
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <ToggleRow
            label="Public"
            value={isPublic}
            onValueChange={setIsPublic}
            style={createStyles.toggleSpacing}
          />

          <ToggleRow
            label="Video on demand"
            subtitle="Store the stream as a VOD after it ends"
            value={recordVod}
            onValueChange={setRecordVod}
            style={createStyles.toggleSpacing}
          />

          {/* Schedule section */}
          <Text style={createStyles.sectionTitle}>Schedule</Text>
          <ToggleRow
            label="Schedule start date and time"
            subtitle="Select when you want to go live"
            value={scheduleEnabled}
            onValueChange={setScheduleEnabled}
            style={createStyles.toggleSpacing}
          />

          {scheduleEnabled ? (
            <>
              <Text style={createStyles.label}>Scheduled start (ISO 8601)</Text>
              <TextInput
                style={createStyles.input}
                value={scheduledStart}
                onChangeText={setScheduledStart}
                placeholder="2026-01-15T18:00:00Z"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={createStyles.label}>Scheduled end (optional)</Text>
              <TextInput
                style={createStyles.input}
                value={scheduledEnd}
                onChangeText={setScheduledEnd}
                placeholder="2026-01-15T20:00:00Z"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <ToggleRow
                label="Enable countdown"
                subtitle="Show a countdown before the stream starts"
                value={enableCountdown}
                onValueChange={setEnableCountdown}
                style={createStyles.toggleSpacing}
              />
            </>
          ) : null}

          {/* DVR section */}
          <Text style={createStyles.sectionTitle}>DVR</Text>
          <ToggleRow
            label="DVR"
            subtitle="Let viewers rewind behind the live point (30s - 12hrs)"
            value={dvrEnabled}
            onValueChange={setDvrEnabled}
            style={createStyles.toggleSpacing}
          />

          {dvrEnabled ? (
            <>
              <Text style={createStyles.label}>DVR timeframe (HH:MM:SS)</Text>
              <TextInput
                style={[createStyles.input, dvrWindowError && createStyles.inputError]}
                value={dvrWindow}
                onChangeText={setDvrWindow}
                placeholder="12:00:00"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {dvrWindowError ? (
                <Text style={createStyles.fieldError}>{dvrWindowError}</Text>
              ) : null}
            </>
          ) : null}

          {/* Pre-stream trailer section */}
          <Text style={createStyles.sectionTitle}>Pre-stream trailer</Text>
          <ToggleRow
            label="Pre-stream trailer"
            subtitle="Play a short video before the stream starts"
            value={trailerEnabled}
            onValueChange={setTrailerEnabled}
            style={createStyles.toggleSpacing}
          />

          {trailerEnabled ? (
            <>
              <Text style={createStyles.label}>Trailer video ID</Text>
              <TextInput
                style={createStyles.input}
                value={trailerVideoId}
                onChangeText={setTrailerVideoId}
                placeholder="Video GUID from your library"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={createStyles.pickerActionsRow}>
                <OutlineButton
                  label={trailerUpload ? 'Uploading…' : 'Upload trailer video'}
                  onPress={handleUploadTrailer}
                  disabled={libraryId == null || trailerUpload != null}
                />
                <OutlineButton
                  label="Choose from library"
                  onPress={handleChooseTrailerFromLibrary}
                  disabled={libraryId == null}
                />
              </View>

              {trailerUpload ? (
                <View style={createStyles.uploadProgressBox}>
                  <ProgressBar progress={trailerUpload.progress} />
                  <Text style={createStyles.uploadProgressText}>
                    {trailerUpload.status === 'failed'
                      ? `Upload failed${trailerUpload.error ? ': ' + trailerUpload.error : ''}`
                      : `${Math.round(trailerUpload.progress * 100)}%`}
                  </Text>
                </View>
              ) : null}

              {trailerVideoId.trim() ? (
                <View style={createStyles.pickedValueRow}>
                  <Text style={createStyles.pickedValueLabel}>Selected trailer:</Text>
                  <Text style={createStyles.pickedValue} numberOfLines={1}>
                    {trailerVideoId.trim()}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setTrailerVideoId('')}
                    style={createStyles.pickedValueClear}
                  >
                    <Text style={createStyles.pickedValueClearText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : null}

          {/* Thumbnail section */}
          <Text style={createStyles.sectionTitle}>Thumbnail</Text>
          <ToggleRow
            label="Thumbnail"
            subtitle="Set a custom thumbnail image"
            value={thumbnailEnabled}
            onValueChange={setThumbnailEnabled}
            style={createStyles.toggleSpacing}
          />

          {thumbnailEnabled ? (
            <>
              <Text style={createStyles.label}>Image URL</Text>
              <TextInput
                style={createStyles.input}
                value={thumbnailUrl}
                onChangeText={(v) => {
                  setThumbnailUrl(v);
                  if (v.trim()) setThumbnailLocalUri(null);
                }}
                placeholder="https://example.com/poster.jpg"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />

              <View style={createStyles.pickerActionsRow}>
                <OutlineButton
                  label="Choose from Photos"
                  onPress={handlePickThumbnailPhoto}
                  disabled={libraryId == null}
                />
                {isEdit && stream ? (
                  <OutlineButton
                    label="Browse generated"
                    onPress={handleBrowseThumbnails}
                    disabled={libraryId == null}
                  />
                ) : null}
              </View>

              {thumbnailLocalUri ? (
                <View style={createStyles.thumbnailPreviewBox}>
                  <Image
                    source={{ uri: thumbnailLocalUri }}
                    style={createStyles.thumbnailPreview}
                    resizeMode="cover"
                  />
                  <Text style={createStyles.thumbnailPreviewHint}>
                    Local image — uploaded after the stream is saved.
                  </Text>
                </View>
              ) : null}

              {!thumbnailLocalUri && thumbnailUrl.trim() ? (
                <ThumbnailPreview url={thumbnailUrl.trim()} />
              ) : null}
            </>
          ) : null}

          {/* RTMP outputs section */}
          <Text style={createStyles.sectionTitle}>RTMP outputs</Text>
          <Text style={createStyles.sectionHint}>
            Forward the stream to external destinations (max {MAX_RTMP}).
          </Text>

          {rtmpOutputs.map((output, i) => (
            <View key={i} style={createStyles.rtmpRow}>
              <Text style={createStyles.label}>Stream URL</Text>
              <TextInput
                style={createStyles.input}
                value={output.url}
                onChangeText={(v) => updateRtmpRow(rtmpOutputs, setRtmpOutputs, i, { url: v })}
                placeholder="rtmp://live.example.com/app"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Text style={createStyles.label}>Stream Key</Text>
              <TextInput
                style={createStyles.input}
                value={output.key}
                onChangeText={(v) => updateRtmpRow(rtmpOutputs, setRtmpOutputs, i, { key: v })}
                placeholder="Optional stream key"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={createStyles.removeButton}
                onPress={() => setRtmpOutputs(rtmpOutputs.filter((_, idx) => idx !== i))}
              >
                <Text style={createStyles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}

          {rtmpOutputs.length < MAX_RTMP ? (
            <TouchableOpacity
              style={createStyles.addButton}
              onPress={() => setRtmpOutputs([...rtmpOutputs, { url: '', key: '' }])}
            >
              <Text style={createStyles.addButtonText}>+ Add RTMP output</Text>
            </TouchableOpacity>
          ) : (
            <Text style={createStyles.maxNote}>Maximum of {MAX_RTMP} RTMP outputs reached.</Text>
          )}

          {error ? <StatusBanner message={error} style={createStyles.errorSpacing} /> : null}

          {saving ? (
            <View style={createStyles.savingRow}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Renders a remote thumbnail URL through `useBunnyImage` — the Bunny CDN
 * requires a `Referer` header that native image pipelines drop, so the hook
 * fetches through JS and renders a `data:` URI. */
function ThumbnailPreview({ url }: { url: string }) {
  return (
    <View style={createStyles.thumbnailPreviewBox}>
      <BunnyThumbnail url={url} style={createStyles.thumbnailPreview} resizeMode="cover" />
      <Text style={createStyles.thumbnailPreviewHint}>Remote image URL</Text>
    </View>
  );
}

const createStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.onSurface,
  },
  cancelButton: {
    fontSize: 16,
    color: colors.primary,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  textDisabled: {
    color: '#bbb',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.onSurface,
  },
  inputError: {
    borderColor: '#d32f2f',
  },
  textArea: {
    minHeight: 80,
  },
  toggleSpacing: {
    marginTop: 8,
  },
  fieldError: {
    color: '#d32f2f',
    fontSize: 12,
    marginTop: 4,
  },
  rtmpRow: {
    marginTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  removeButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  removeButtonText: {
    color: '#d32f2f',
    fontSize: 14,
  },
  addButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  maxNote: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginTop: 12,
    textAlign: 'center',
  },
  errorSpacing: {
    marginTop: 16,
  },
  savingRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  pickerActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  uploadProgressBox: {
    marginTop: 10,
  },
  uploadProgressText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  pickedValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  pickedValueLabel: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  pickedValue: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.onSurface,
  },
  pickedValueClear: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d32f2f',
  },
  pickedValueClearText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d32f2f',
  },
  thumbnailPreviewBox: {
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  thumbnailPreview: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  thumbnailPreviewHint: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    padding: 6,
  },
});
