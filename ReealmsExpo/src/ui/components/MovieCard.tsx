import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { gradients, palette } from '../../core/theme';
import type { Movie } from '../../data/models/media';

type MovieCardProps = {
  movie: Movie;
  isFavorite?: boolean;
  onPress: () => void;
};

function prettySourceLabel(sourceType: string) {
  switch (sourceType) {
    case 'dramabox':
      return 'Drama';
    case 'otakudesu':
      return 'Anime';
    case 'komik':
      return 'Komik';
    default:
      return sourceType;
  }
}

export function MovieCard({ movie, isFavorite = false, onPress }: MovieCardProps) {
  const [posterFailed, setPosterFailed] = React.useState(false);
  const metaLabel = movie.year || prettySourceLabel(movie.sourceType);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
    >
      <View style={styles.posterFrame}>
        {!posterFailed && movie.posterUrl ? (
          <Image
            onError={() => setPosterFailed(true)}
            resizeMode="cover"
            source={{ uri: movie.posterUrl }}
            style={styles.poster}
          />
        ) : (
          <View style={styles.posterFallback}>
            <Text style={styles.posterFallbackText}>{movie.title.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <LinearGradient colors={gradients.posterFade} style={styles.posterFade} />
        <View style={styles.badgeRow}>
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>{prettySourceLabel(movie.sourceType)}</Text>
          </View>
          {isFavorite ? (
            <View style={styles.favoriteBadge}>
              <Ionicons color={palette.accentGold} name="bookmark" size={15} />
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.copyBlock}>
        <Text numberOfLines={2} style={styles.title}>
          {movie.title}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Text numberOfLines={1} style={styles.metaText}>
              {metaLabel}
            </Text>
          </View>
          {movie.rating > 0 ? (
            <View style={styles.ratingWrap}>
              <Ionicons color={palette.accentGold} name="star" size={12} />
              <Text style={styles.ratingText}>{movie.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.988 }],
  },
  posterFrame: {
    aspectRatio: 0.735,
    backgroundColor: palette.surfaceRaised,
  },
  poster: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceRaised,
  },
  posterFallbackText: {
    color: palette.textPrimary,
    fontSize: 34,
    fontWeight: '700',
  },
  posterFade: {
    ...StyleSheet.absoluteFillObject,
  },
  badgeRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceBadge: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.surfaceOverlay,
    borderWidth: 1,
    borderColor: palette.border,
  },
  sourceBadgeText: {
    color: palette.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  favoriteBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.surfaceOverlay,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBlock: {
    gap: 10,
    paddingHorizontal: 15,
    paddingTop: 14,
    paddingBottom: 16,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },
  metaPill: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaText: {
    color: palette.textMuted,
    fontSize: 11,
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: palette.accentGold,
    fontSize: 11,
    fontWeight: '700',
  },
});
