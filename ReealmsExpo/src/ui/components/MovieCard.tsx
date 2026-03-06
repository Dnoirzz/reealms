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
          {isFavorite ? <Ionicons color={palette.accentGold} name="bookmark" size={18} /> : null}
        </View>
      </View>

      <View style={styles.copyBlock}>
        <Text numberOfLines={2} style={styles.title}>
          {movie.title}
        </Text>
        <View style={styles.metaRow}>
          <Text numberOfLines={1} style={styles.metaText}>
            {metaLabel}
          </Text>
          {movie.rating > 0 ? (
            <Text style={styles.ratingText}>{movie.rating.toFixed(1)}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  posterFrame: {
    aspectRatio: 0.74,
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
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(4, 5, 10, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  sourceBadgeText: {
    color: palette.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  copyBlock: {
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },
  metaText: {
    color: palette.textMuted,
    fontSize: 11,
    flex: 1,
  },
  ratingText: {
    color: palette.accentGold,
    fontSize: 11,
    fontWeight: '700',
  },
});
