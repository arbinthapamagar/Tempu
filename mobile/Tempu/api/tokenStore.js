// TODO: Replace AsyncStorage with expo-secure-store for encrypted token storage
// once it is added to the project dependencies. Tokens are kept in-memory via
// _access/_refresh so that all in-process reads are never round-tripped through
// unencrypted storage; AsyncStorage is only used for persistence across restarts.
import AsyncStorage from '@react-native-async-storage/async-storage';

let _access = null;
let _refresh = null;

export const tokenStore = {
  get: () => ({ accessToken: _access, refreshToken: _refresh }),

  set: async (access, refresh) => {
    _access = access;
    _refresh = refresh;
    await AsyncStorage.multiSet([
      ['shakti_access', access],
      ['shakti_refresh', refresh],
    ]);
  },

  load: async () => {
    const pairs = await AsyncStorage.multiGet(['shakti_access', 'shakti_refresh']);
    _access = pairs[0][1];
    _refresh = pairs[1][1];
    return { accessToken: _access, refreshToken: _refresh };
  },

  clear: async () => {
    _access = null;
    _refresh = null;
    await AsyncStorage.multiRemove(['shakti_access', 'shakti_refresh']);
  },
};
