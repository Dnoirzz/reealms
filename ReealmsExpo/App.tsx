import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BackHandler, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppStateProvider, useAppState } from './src/logic/AppStateContext';
import { appConstants, tabOptions, type AppTab } from './src/core/constants';
import { gradients, palette } from './src/core/theme';
import type { Movie } from './src/data/models/media';
import { HomeScreen } from './src/ui/screens/HomeScreen';
import { SearchScreen } from './src/ui/screens/SearchScreen';
import { HistoryScreen } from './src/ui/screens/HistoryScreen';
import { ProfileScreen } from './src/ui/screens/ProfileScreen';
import { DetailScreen } from './src/ui/screens/DetailScreen';

function ReealmsRoot() {
  const insets = useSafeAreaInsets();
  const { canEnterMainNavigation, history, isAuthReady } = useAppState();
  const [tab, setTab] = React.useState<AppTab>('home');
  const [selectedMovie, setSelectedMovie] = React.useState<Movie | null>(null);

  React.useEffect(() => {
    if (!canEnterMainNavigation) {
      setTab('profile');
      setSelectedMovie(null);
    }
  }, [canEnterMainNavigation]);

  React.useEffect(() => {
    if (!selectedMovie) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedMovie(null);
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [selectedMovie]);

  if (!isAuthReady) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={gradients.shellBackdrop}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.bootSplash}>
          <Image source={require('./assets/branding/logo.png')} style={styles.bootLogo} />
          <Text style={styles.bootTitle}>{appConstants.appName}</Text>
          <Text style={styles.bootCaption}>Preparing the Expo migration shell...</Text>
        </View>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!canEnterMainNavigation) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={gradients.shellBackdrop}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />
        <ProfileScreen authGateMode />
        <StatusBar style="light" />
      </View>
    );
  }

  const recentMovie = history[0];

  if (selectedMovie) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={gradients.shellBackdrop}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />
        <DetailScreen movie={selectedMovie} onBack={() => setSelectedMovie(null)} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradients.shellBackdrop}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.screenDeck}>
        <View style={[styles.screenSlot, tab === 'home' ? styles.screenVisible : styles.screenHidden]}>
          <HomeScreen onOpenMovie={setSelectedMovie} />
        </View>
        <View style={[styles.screenSlot, tab === 'search' ? styles.screenVisible : styles.screenHidden]}>
          <SearchScreen onOpenMovie={setSelectedMovie} />
        </View>
        <View style={[styles.screenSlot, tab === 'history' ? styles.screenVisible : styles.screenHidden]}>
          <HistoryScreen onOpenMovie={setSelectedMovie} />
        </View>
        <View style={[styles.screenSlot, tab === 'profile' ? styles.screenVisible : styles.screenHidden]}>
          <ProfileScreen />
        </View>
      </View>

      {recentMovie ? (
        <Pressable accessibilityRole="button" onPress={() => setSelectedMovie(recentMovie)} style={styles.resumeBar}>
          <View style={styles.resumeCopy}>
            <Text style={styles.resumeEyebrow}>Recently opened</Text>
            <Text numberOfLines={1} style={styles.resumeTitle}>
              {recentMovie.title}
            </Text>
          </View>
          <Ionicons color={palette.textPrimary} name="arrow-forward-circle-outline" size={24} />
        </Pressable>
      ) : null}

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {tabOptions.map((option) => {
          const active = option.id === tab;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={option.id}
              onPress={() => setTab(option.id)}
              style={({ pressed }) => [
                styles.tabItem,
                active ? styles.tabItemActive : null,
                pressed ? styles.tabItemPressed : null,
              ]}
            >
              <Ionicons
                color={active ? palette.textPrimary : palette.textMuted}
                name={option.icon}
                size={20}
              />
              <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <ReealmsRoot />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  screenDeck: {
    flex: 1,
  },
  screenSlot: {
    flex: 1,
  },
  screenVisible: {
    display: 'flex',
  },
  screenHidden: {
    display: 'none',
  },
  bootSplash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  bootLogo: {
    width: 88,
    height: 88,
    borderRadius: 24,
  },
  bootTitle: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  bootCaption: {
    color: palette.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  resumeBar: {
    marginHorizontal: 18,
    marginBottom: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  resumeCopy: {
    flex: 1,
    gap: 4,
  },
  resumeEyebrow: {
    color: palette.accentCool,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  resumeTitle: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  tabBar: {
    marginHorizontal: 18,
    marginBottom: 16,
    padding: 8,
    borderRadius: 26,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    gap: 8,
  },
  tabItem: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: palette.surfaceRaised,
  },
  tabItemPressed: {
    opacity: 0.88,
  },
  tabLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: palette.textPrimary,
  },
});
