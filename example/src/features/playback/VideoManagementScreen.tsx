import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { BunnyStreamApi, type VideoCodec } from '@bunny.net/stream-react-native';

import { Header } from '../../components/Header';
import { OutlineButton } from '../../components/OutlineButton';
import { StatusBanner } from '../../components/StatusBanner';
import { pickImage } from '../../media/picker';
import { colors } from '../../theme/colors';
import { styles } from '../../theme/styles';

type VideoManagementScreenProps = NativeStackScreenProps<RootStackParamList, 'VideoManagement'>;

const CODECS: VideoCodec[] = ['h264', 'vp9', 'hevc', 'av1'];

export function VideoManagementScreen({ navigation, route }: VideoManagementScreenProps) {
  const { videoId, libraryId } = route.params;

  const [thumbnailUrl, setThumbnailUrl] = React.useState('');
  const [fetchUrl, setFetchUrl] = React.useState('');
  const [refetchUrl, setRefetchUrl] = React.useState('');
  const [captionLanguage, setCaptionLanguage] = React.useState('en');
  const [captionLabel, setCaptionLabel] = React.useState('English');
  const [captionBase64, setCaptionBase64] = React.useState('');
  const [deleteCaptionLang, setDeleteCaptionLang] = React.useState('en');
  const [selectedCodec, setSelectedCodec] = React.useState<VideoCodec>('h264');
  const [resolutionInput, setResolutionInput] = React.useState('720p');

  const [status, setStatus] = React.useState<{ message: string; ok: boolean } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const runAction = async (
    label: string,
    fn: () => Promise<{ ok: boolean; error?: { message: string }; data?: unknown }>,
  ) => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await fn();
      if (result.ok) {
        setStatus({ message: `${label}: OK`, ok: true });
      } else {
        setStatus({ message: `${label}: ${result.error?.message ?? 'failed'}`, ok: false });
      }
    } catch (e) {
      setStatus({
        message: `${label}: ${e instanceof Error ? e.message : String(e)}`,
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSetThumbnail = () =>
    runAction('setThumbnail', () =>
      BunnyStreamApi.setThumbnail(libraryId, videoId, thumbnailUrl).then((r) => ({
        ok: r.ok,
        error: r.ok ? undefined : { message: r.error.message },
      })),
    );

  const handleUploadThumbnail = async () => {
    const picked = await pickImage();
    if (!picked) return;
    runAction('uploadThumbnail', () =>
      BunnyStreamApi.uploadThumbnail(libraryId, videoId, picked.uri).then((r) => ({
        ok: r.ok,
        error: r.ok ? undefined : { message: r.error.message },
      })),
    );
  };

  const handleFetchNewVideo = () =>
    runAction('fetchNewVideo', () =>
      BunnyStreamApi.fetchNewVideo({
        libraryId,
        request: { url: fetchUrl },
      }).then((r) => ({ ok: r.ok, error: r.ok ? undefined : { message: r.error.message } })),
    );

  const handleRefetchVideo = () =>
    runAction('refetchVideo', () =>
      BunnyStreamApi.refetchVideo({
        libraryId,
        videoId,
        request: { url: refetchUrl },
      }).then((r) => ({ ok: r.ok, error: r.ok ? undefined : { message: r.error.message } })),
    );

  const handleAddCaption = () =>
    runAction('addCaption', () =>
      BunnyStreamApi.addCaption(libraryId, videoId, {
        languageCode: captionLanguage,
        label: captionLabel,
        captionsFileBase64: captionBase64,
      }).then((r) => ({ ok: r.ok, error: r.ok ? undefined : { message: r.error.message } })),
    );

  const handleDeleteCaption = () =>
    runAction('deleteCaption', () =>
      BunnyStreamApi.deleteCaption(libraryId, videoId, deleteCaptionLang).then((r) => ({
        ok: r.ok,
        error: r.ok ? undefined : { message: r.error.message },
      })),
    );

  const handleReencode = () =>
    runAction('reencodeVideo', () =>
      BunnyStreamApi.reencodeVideo(libraryId, videoId).then((r) => ({
        ok: r.ok,
        error: r.ok ? undefined : { message: r.error.message },
      })),
    );

  const handleReencodeCodec = () =>
    runAction('reencodeUsingCodec', () =>
      BunnyStreamApi.reencodeUsingCodec(libraryId, videoId, selectedCodec).then((r) => ({
        ok: r.ok,
        error: r.ok ? undefined : { message: r.error.message },
      })),
    );

  const handleRepackage = () =>
    runAction('repackageVideo', () =>
      BunnyStreamApi.repackageVideo(libraryId, videoId, true).then((r) => ({
        ok: r.ok,
        error: r.ok ? undefined : { message: r.error.message },
      })),
    );

  const handleDeleteResolutionsDryRun = () =>
    runAction('deleteResolutions (dryRun)', () =>
      BunnyStreamApi.deleteResolutions({
        libraryId,
        videoId,
        resolutions: resolutionInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        dryRun: true,
      }).then((r) => ({ ok: r.ok, error: r.ok ? undefined : { message: r.error.message } })),
    );

  const handleDeleteResolutionsConfirm = () =>
    runAction('deleteResolutions', () =>
      BunnyStreamApi.deleteResolutions({
        libraryId,
        videoId,
        resolutions: resolutionInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        dryRun: false,
      }).then((r) => ({ ok: r.ok, error: r.ok ? undefined : { message: r.error.message } })),
    );

  const handleTranscribe = () =>
    runAction('transcribeVideo', () =>
      BunnyStreamApi.transcribeVideo({
        libraryId,
        videoId,
        request: { generateTitle: true, generateDescription: true },
      }).then((r) => ({ ok: r.ok, error: r.ok ? undefined : { message: r.error.message } })),
    );

  const handleSmartGenerate = () =>
    runAction('smartGenerate', () =>
      BunnyStreamApi.smartGenerate(libraryId, videoId, {
        generateTitle: true,
        generateDescription: true,
      }).then((r) => ({ ok: r.ok, error: r.ok ? undefined : { message: r.error.message } })),
    );

  return (
    <>
      <Header title="Video Management" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content} contentContainerStyle={mgmtStyles.content}>
        <Text style={mgmtStyles.videoIdLabel}>Video ID</Text>
        <Text style={mgmtStyles.videoIdValue} numberOfLines={1}>
          {videoId}
        </Text>

        {status ? (
          <StatusBanner
            message={status.message}
            variant={status.ok ? 'success' : 'error'}
            style={mgmtStyles.statusBox}
          />
        ) : null}

        {busy ? (
          <View style={mgmtStyles.busyRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={mgmtStyles.busyText}>Working…</Text>
          </View>
        ) : null}

        {/* Thumbnail */}
        <Section title="Thumbnail">
          <LabeledInput label="Thumbnail URL" value={thumbnailUrl} onChangeText={setThumbnailUrl} />
          <ActionButton label="Set thumbnail URL" onPress={handleSetThumbnail} />
          <ActionButton label="Upload thumbnail (Android only)" onPress={handleUploadThumbnail} />
          <PlatformNote note="uploadThumbnail is Android-only; iOS returns InvalidState." />
        </Section>

        {/* Import */}
        <Section title="Import">
          <LabeledInput label="Fetch URL" value={fetchUrl} onChangeText={setFetchUrl} />
          <ActionButton label="Fetch new video" onPress={handleFetchNewVideo} />
          <LabeledInput label="Refetch URL" value={refetchUrl} onChangeText={setRefetchUrl} />
          <ActionButton label="Refetch video" onPress={handleRefetchVideo} />
          <PlatformNote note="refetchVideo is Android-native; iOS falls back to getVideo." />
        </Section>

        {/* Captions */}
        <Section title="Captions">
          <LabeledInput
            label="Language code"
            value={captionLanguage}
            onChangeText={setCaptionLanguage}
          />
          <LabeledInput label="Label" value={captionLabel} onChangeText={setCaptionLabel} />
          <LabeledInput
            label="Base64 SRT/VTT"
            value={captionBase64}
            onChangeText={setCaptionBase64}
            multiline
          />
          <ActionButton label="Add caption" onPress={handleAddCaption} />
          <LabeledInput
            label="Delete language code"
            value={deleteCaptionLang}
            onChangeText={setDeleteCaptionLang}
          />
          <ActionButton label="Delete caption" onPress={handleDeleteCaption} danger />
        </Section>

        {/* Encoding */}
        <Section title="Encoding">
          <ActionButton label="Reencode (default codec)" onPress={handleReencode} />
          <Text style={mgmtStyles.subLabel}>Codec</Text>
          <View style={mgmtStyles.codecRow}>
            {CODECS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  mgmtStyles.codecButton,
                  c === selectedCodec && mgmtStyles.codecButtonActive,
                ]}
                onPress={() => setSelectedCodec(c)}
              >
                <Text
                  style={[mgmtStyles.codecText, c === selectedCodec && mgmtStyles.codecTextActive]}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ActionButton label="Reencode with codec" onPress={handleReencodeCodec} />
          <ActionButton label="Repackage" onPress={handleRepackage} />
        </Section>

        {/* Delete resolutions */}
        <Section title="Delete resolutions (destructive)">
          <LabeledInput
            label="Resolutions (comma-separated)"
            value={resolutionInput}
            onChangeText={setResolutionInput}
          />
          <ActionButton label="Dry run (preview)" onPress={handleDeleteResolutionsDryRun} />
          <ActionButton label="Confirm delete" onPress={handleDeleteResolutionsConfirm} danger />
          <PlatformNote note="Always dry-run first to preview what would be deleted." />
        </Section>

        {/* AI */}
        <Section title="AI">
          <ActionButton label="Transcribe video" onPress={handleTranscribe} />
          <ActionButton label="Smart generate (Android only)" onPress={handleSmartGenerate} />
          <PlatformNote note="smartGenerate is Android-only; iOS returns InvalidState." />
        </Section>
      </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={mgmtStyles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={mgmtStyles.inputGroup}>
      <Text style={mgmtStyles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && mgmtStyles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.onSurfaceVariant}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
      />
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <OutlineButton
      label={label}
      onPress={onPress}
      danger={danger}
      style={mgmtStyles.actionButton}
      textStyle={mgmtStyles.actionButtonText}
    />
  );
}

function PlatformNote({ note }: { note: string }) {
  return <Text style={mgmtStyles.platformNote}>{note}</Text>;
}

const mgmtStyles = StyleSheet.create({
  content: {
    paddingBottom: 48,
  },
  videoIdLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  videoIdValue: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: colors.onSurface,
    marginBottom: 16,
  },
  statusBox: {
    marginBottom: 12,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  busyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  section: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 14,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    marginBottom: 4,
    marginTop: 4,
  },
  codecRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  codecButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  codecButtonActive: {
    backgroundColor: colors.primary,
  },
  codecText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  codecTextActive: {
    color: colors.onPrimary,
  },
  platformNote: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
