import * as Haptics from 'expo-haptics';

// Thin wrappers so call-sites stay readable. All swallow errors silently —
// haptics are a non-essential nice-to-have.

export function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function pick() {
  Haptics.selectionAsync().catch(() => {});
}

export function confirm() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function success() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
}
