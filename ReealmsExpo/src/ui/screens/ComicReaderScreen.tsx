import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  Image as RNImage,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../../core/theme';

type ComicReaderScreenProps = {
  imageUrls: string[];
  title: string;
  onBack: () => void;
};

function ComicPage({ uri }: { uri: string }) {
  const [aspectRatio, setAspectRatio] = React.useState(0.72);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    RNImage.getSize(
      uri,
      (width, height) => {
        if (active && width > 0 && height > 0) {
          setAspectRatio(width / height);
        }
      },
      () => {
        if (active) {
          setAspectRatio(0.72);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [uri]);

  return (
    <View style={styles.pageWrap}>
      <Image
        onError={() => setLoading(false)}
        onLoadEnd={() => setLoading(false)}
        resizeMode="contain"
        source={{ uri }}
        style={[styles.pageImage, { aspectRatio }]}
      />
      {loading ? (
        <View style={styles.pageOverlay}>
          <ActivityIndicator color={palette.accentGold} size="small" />
        </View>
      ) : null}
    </View>
  );
}

export function ComicReaderScreen({ imageUrls, title, onBack }: ComicReaderScreenProps) {
  const insets = useSafeAreaInsets();
  const [showHeader, setShowHeader] = React.useState(true);

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [onBack]);

  return (
    <View style={styles.readerRoot}>
      {showHeader ? (
        <View style={[styles.readerHeader, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onBack} style={styles.readerIconButton}>
            <Ionicons color={palette.textPrimary} name="arrow-back" size={20} />
          </Pressable>
          <View style={styles.readerHeaderCopy}>
            <Text numberOfLines={1} style={styles.readerTitle}>
              {title}
            </Text>
            <Text style={styles.readerSubtitle}>{imageUrls.length} halaman</Text>
          </View>
        </View>
      ) : null}

      <FlatList
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 20), paddingTop: showHeader ? 12 : insets.top + 12 }}
        data={imageUrls}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={({ item }) => (
          <Pressable onPress={() => setShowHeader((value) => !value)}>
            <ComicPage uri={item} />
          </Pressable>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  readerRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  readerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.54)',
  },
  readerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  readerHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  readerTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  readerSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
  },
  pageWrap: {
    marginBottom: 10,
    backgroundColor: '#000000',
  },
  pageImage: {
    width: '100%',
    backgroundColor: '#000000',
  },
  pageOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
