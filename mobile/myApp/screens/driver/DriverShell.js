import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import ProfileScreen from '../ProfileScreen';
import DriverEarnings from './DriverEarnings';
import DriverHome from './DriverHome';
import useDriverFlow from './useDriverFlow';

const TABS = [
  { id: 'home', label: 'Drive', icon: 'car-sport' },
  { id: 'earnings', label: 'Earnings', icon: 'wallet' },
  { id: 'account', label: 'Account', icon: 'person' },
];

function DriverTabBar({ active, onChange, locked }) {
  return (
    <View style={styles.tabbar}>
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <Pressable
            key={t.id}
            style={styles.tab}
            onPress={() => !locked && onChange(t.id)}
            hitSlop={6}
          >
            <Ionicons
              name={isActive ? t.icon : `${t.icon}-outline`}
              size={23}
              color={isActive ? colors.primary : (locked ? colors.textFaint : colors.textMuted)}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The full Driver Mode workspace. Owns the driver flow hook so online state,
 * nearby trips, and an in-progress trip persist while switching tabs.
 */
export default function DriverShell({ initialOnline, onSwitchToPassenger, onSignOut }) {
  const [tab, setTab] = useState('home');
  const flow = useDriverFlow(initialOnline);

  // While driving an active trip, lock the tabs to the Drive screen.
  const drivingLocked = !!flow.activeTrip && flow.activeTrip.status !== 'completed';

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        {tab === 'home' && <DriverHome flow={flow} />}
        {tab === 'earnings' && <DriverEarnings />}
        {tab === 'account' && (
          <ProfileScreen
            onBack={() => setTab('home')}
            onSignOut={onSignOut}
            onSwitchToPassenger={onSwitchToPassenger}
          />
        )}
      </View>
      <DriverTabBar
        active={drivingLocked ? 'home' : tab}
        onChange={setTab}
        locked={drivingLocked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  tabbar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingBottom: 18,
  },
  tab: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 4 },
  label: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  labelActive: { color: colors.primary, fontWeight: '700' },
});
