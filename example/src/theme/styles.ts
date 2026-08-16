import { StyleSheet } from 'react-native';

import { colors } from './colors';

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
    shadowColor: Black20Color(),
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
    backgroundColor: 'rgba(37, 88, 143, 0.1)',
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
    borderColor: 'rgba(24, 61, 109, 0.15)',
  },
  saveButtonContainer: {
    marginTop: 16,
  },
  // Player screen
  playerContainer: {
    flex: 1,
    backgroundColor: colors.onSurface,
  },
  player: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Black20Color(),
  },
  status: {
    color: colors.onPrimary,
    textAlign: 'center',
    padding: 8,
    backgroundColor: 'rgba(24, 61, 109, 0.9)',
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    borderColor: 'rgba(24, 61, 109, 0.15)',
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
  videoIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  videoIdText: {
    fontSize: 15,
    color: colors.onSurface,
    flex: 1,
  },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeButtonText: {
    fontSize: 18,
    color: colors.onSurfaceVariant,
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
  loadingText: {
    color: colors.onSurfaceVariant,
    marginTop: 12,
    fontSize: 14,
  },
});

// Helper to avoid re-evaluating rgba at module load for shadow color.
function Black20Color() {
  return '#000000';
}
