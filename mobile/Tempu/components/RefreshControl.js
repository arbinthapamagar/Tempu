// Native platforms keep React Native's own pull-to-refresh. The web build gets
// RefreshControl.web.js instead, because react-native-web's version is a no-op.
export { RefreshControl as default } from 'react-native';
