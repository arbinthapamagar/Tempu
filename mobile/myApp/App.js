import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { useFonts, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk';
import { SplineSansMono_500Medium, SplineSansMono_600SemiBold } from '@expo-google-fonts/spline-sans-mono';
import TabBar from './components/TabBar';
import { AuthProvider, useAuth } from './context/AuthContext';
import DriverShell from './screens/driver/DriverShell';
import ContactSupportScreen from './screens/ContactSupportScreen';
import DriverPendingScreen from './screens/DriverPendingScreen';
import DriverVehicleScreen from './screens/DriverVehicleScreen';
import HomeScreen from './screens/home';
import InboxScreen from './screens/InboxScreen';
import LoginScreen from './screens/LoginScreen';
import OtpScreen from './screens/OtpScreen';
import ProfileScreen from './screens/ProfileScreen';
import RegisterScreen from './screens/RegisterScreen';
import RoleSelectScreen from './screens/RoleSelectScreen';
import SubscriptionScreen from './screens/SubscriptionScreen';
import SupportScreen from './screens/SupportScreen';
import TripsScreen from './screens/TripsScreen';
import WalletScreen from './screens/WalletScreen';
import { colors, isDark } from './theme/colors';

// App is a white (Uber-style light) theme, so the status bar needs dark icons.
const STATUS_BAR_STYLE = 'dark-content';

// authScreen values:
// 'role-select' | 'login' | 'register' | 'otp' — unauthenticated
// 'driver-vehicle' | 'driver-pending'          — authenticated, driver onboarding
function AppShell() {
  const { user, loading } = useAuth();
  const [authScreen, setAuthScreen] = useState('role-select');
  const [role, setRole] = useState('passenger'); // 'passenger' | 'driver'
  const [pendingPhone, setPendingPhone] = useState('');
  const [tab, setTab] = useState('home');
  const [overlay, setOverlay] = useState(null);
  const [mode, setModeState] = useState('passenger'); // 'passenger' | 'driver'

  // Restore last-used mode across restarts
  useEffect(() => {
    AsyncStorage.getItem('shakti_mode').then((m) => {
      if (m === 'driver') setModeState('driver');
    });
  }, []);

  const setMode = (m) => {
    setModeState(m);
    AsyncStorage.setItem('shakti_mode', m).catch(() => {});
  };

  // Only let a user enter driver mode if their driver profile is approved
  const approvedDriver = user?.driverProfile?.status === 'approved';
  const effectiveMode = mode === 'driver' && approvedDriver ? 'driver' : 'passenger';

  // After OTP verification the user becomes set in context.
  // If they chose the driver role, transition to vehicle details form.
  useEffect(() => {
    if (user && role === 'driver' && authScreen === 'otp') {
      setAuthScreen('driver-vehicle');
    }
  }, [user, role, authScreen]);

  // Reset to home tab on passenger login
  useEffect(() => {
    if (user && role === 'passenger') setTab('home');
  }, [user, role]);

  if (loading) {
    return (
      <SafeAreaView style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // Driver onboarding (user is logged in but completing driver setup)
  if (user && authScreen === 'driver-vehicle') {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle={STATUS_BAR_STYLE} backgroundColor={colors.background} />
        <DriverVehicleScreen
          onSuccess={() => setAuthScreen('driver-pending')}
          onBack={() => setAuthScreen('otp')}
        />
      </SafeAreaView>
    );
  }

  if (user && authScreen === 'driver-pending') {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle={STATUS_BAR_STYLE} backgroundColor={colors.background} />
        <DriverPendingScreen />
      </SafeAreaView>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle={STATUS_BAR_STYLE} backgroundColor={colors.background} />

        {authScreen === 'role-select' && (
          <RoleSelectScreen
            onPassenger={() => { setRole('passenger'); setAuthScreen('register'); }}
            onDriver={() => { setRole('driver'); setAuthScreen('register'); }}
            onSignIn={() => setAuthScreen('login')}
            onContact={() => setAuthScreen('contact')}
          />
        )}

        {authScreen === 'login' && (
          <LoginScreen
            onGoToRegister={() => setAuthScreen('role-select')}
            onContact={() => setAuthScreen('contact')}
          />
        )}

        {authScreen === 'contact' && (
          <ContactSupportScreen onBack={() => setAuthScreen('role-select')} />
        )}

        {authScreen === 'register' && (
          <RegisterScreen
            onGoToLogin={() => setAuthScreen('login')}
            onRegistered={(phone) => {
              setPendingPhone(phone);
              setAuthScreen('otp');
            }}
          />
        )}

        {authScreen === 'otp' && (
          <OtpScreen
            phone={pendingPhone}
            onSuccess={() => {
              // For passengers, AuthContext sets user → this branch re-renders to passenger app.
              // For drivers, the useEffect above catches user being set and moves to driver-vehicle.
            }}
            onBack={() => setAuthScreen('register')}
          />
        )}
      </SafeAreaView>
    );
  }

  const signOut = async () => {
    setOverlay(null);
    setTab('home');
    setAuthScreen('role-select');
    setRole('passenger');
    setMode('passenger');
  };

  // Driver mode
  if (effectiveMode === 'driver') {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle={STATUS_BAR_STYLE} backgroundColor={colors.background} />
        <DriverShell
          initialOnline={user?.driverProfile?.isOnline ?? false}
          onSwitchToPassenger={() => setMode('passenger')}
          onSignOut={signOut}
        />
      </SafeAreaView>
    );
  }

  // Passenger app
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle={STATUS_BAR_STYLE} backgroundColor={colors.background} />

      {overlay === 'subscription' && (
        <SubscriptionScreen onBack={() => setOverlay(null)} />
      )}

      {!overlay && (
        <View style={styles.body}>
          <View style={styles.content}>
            {tab === 'home' && <HomeScreen />}
            {tab === 'trips' && <TripsScreen />}
            {tab === 'wallet' && <WalletScreen />}
            {tab === 'subscribe' && <SubscriptionScreen onBack={() => setTab('home')} />}
            {tab === 'inbox' && <InboxScreen />}
            {tab === 'support' && <SupportScreen role="passenger" onBack={() => setTab('home')} />}
            {tab === 'account' && (
              <ProfileScreen
                onBack={() => setTab('home')}
                onSignOut={signOut}
                onOpenSubscription={() => setTab('subscribe')}
                onSwitchToDriver={() => setMode('driver')}
              />
            )}
          </View>
          <TabBar active={tab} onChange={setTab} />
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    SplineSansMono_500Medium,
    SplineSansMono_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.splash}>
        <StatusBar barStyle={STATUS_BAR_STYLE} backgroundColor={colors.background} />
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  splash: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  content: { flex: 1 },
});
