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

function ReealmsRoot() {
  const insets = useSafeAreaInsets();
  const { canEnterMainNavigation, history, isAuthReady, removeFromHistory } = useAppState();
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
          <Text style={styles.bootCaption}>Menyiapkan aplikasi...</Text>
        </View>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!canEnterMainNavigation) {
    return (
      <View style={styles.root}>
        <ProfileScreen authGateMode />
        <StatusBar style="light" />
      </View>
    );
  }

  const recentMovie = history[0];

  if (selectedMovie) {
    const { DetailScreen } = require('./src/ui/screens/DetailScreen') as typeof import('./src/ui/screens/DetailScreen');

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
        <View style={styles.resumeBar}>
          <Image source={{ uri: recentMovie.posterUrl }} style={styles.resumePoster} />
          <View style={styles.resumeCopy}>
            <Text style={styles.resumeEyebrow}>Lanjutkan tontonan...</Text>
            <Text numberOfLines={1} style={styles.resumeTitle}>
              {recentMovie.title}
            </Text>
          </View>
          <View style={styles.resumeActions}>
            <Pressable accessibilityRole="button" onPress={() => setSelectedMovie(recentMovie)} style={styles.resumeButton}>
              <Text style={styles.resumeButtonText}>Lanjutkan</Text>
            </Pressable>
            <Pressable onPress={() => void removeFromHistory(recentMovie.id)} style={styles.resumeCloseButton}>
              <Ionicons color={palette.textFaint} name="close" size={16} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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
                color={active ? palette.accent : palette.textMuted}
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
    marginHorizontal: 14,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  resumePoster: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: palette.surfaceRaised,
  },
  resumeCopy: {
    flex: 1,
    gap: 2,
  },
  resumeEyebrow: {
    color: palette.textFaint,
    fontSize: 11,
  },
  resumeTitle: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  resumeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resumeButton: {
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  resumeButtonText: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  resumeCloseButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    paddingTop: 6,
    paddingHorizontal: 8,
    backgroundColor: palette.background,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabItem: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabItemActive: {},
  tabItemPressed: {
    opacity: 0.88,
  },
  tabLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: palette.accent,
  },
});
