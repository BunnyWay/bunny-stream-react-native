import { StyleSheet } from 'react-native';

import { Black, colors } from './colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    minHeight: 44,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.onPrimary,
    opacity: 0.85,
    marginTop: 2,
  },
  backButton: {
    width: 60,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 17,
    color: colors.onPrimary,
  },
  // Content
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
  },
  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    shadowColor: Black,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  optionRow: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    color: colors.onSurface,
  },
  optionTitleDisabled: {
    color: colors.disabled,
  },
  optionSubtitle: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  comingSoonBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    backgroundColor: colors.onSurfaceVariant10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginHorizontal: 16,
  },
  // Inputs
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.onSurface15,
  },
  saveButtonContainer: {
    marginTop: 16,
  },
  // Player screen
  playerContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  player: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Black,
  },
  playerWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    backgroundColor: Black,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transitionalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  transitionalText: {
    fontSize: 14,
    color: colors.onPrimary85,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrimHeavy,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: colors.onPrimary80,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorVideoId: {
    fontSize: 12,
    color: colors.onPrimary60,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'monospace',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    color: colors.onSurface,
    textAlign: 'center',
    padding: 8,
    backgroundColor: colors.surface,
  },
  // Speed control
  speedSection: {
    padding: 16,
  },
  speedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 12,
  },
  speedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  speedButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  speedButtonActive: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  speedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  speedButtonTextActive: {
    color: colors.onPrimary,
  },
  // Custom player controls
  controlsSection: {
    padding: 16,
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 20,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  controlButtonPrimary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  controlButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  positionBar: {
    marginVertical: 8,
  },
  positionText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    fontFamily: 'monospace',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginBottom: 16,
  },
  // Label above an input inside a modal — more space above (separates from
  // previous field), less space below (visually attaches to its input).
  modalFieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    marginTop: 16,
    marginBottom: 4,
  },
  // First field label in a modal — no extra top margin (title/subtitle already
  // provides separation).
  modalFieldLabelFirst: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    marginTop: 0,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 0,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.onSurface15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  // Video list
  videoListEmpty: {
    flex: 1,
    textAlign: 'center',
    color: colors.onSurfaceVariant,
    marginTop: 32,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  addButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
