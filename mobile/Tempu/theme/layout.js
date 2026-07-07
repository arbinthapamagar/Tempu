import { Platform, StatusBar } from 'react-native';

// Distance from the top of the screen to the first row of content.
// Android: status bar height + a hair; iOS: SafeAreaView already handles it.
export const STATUS_TOP_PAD =
  Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 4 : 4;

export const SHEET_HANDLE_HEIGHT = 4;
