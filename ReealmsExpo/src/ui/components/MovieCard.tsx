import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from '../../core/theme';
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
  const metaLabel = movie.genres[0] || prettySourceLabel(movie.sourceType);

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
        {isFavorite ? (
          <View style={styles.favoriteBadge}>
            <Ionicons color={palette.accentStrong} name="bookmark" size={11} />
          </View>
        ) : null}
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>Terpopuler</Text>
        </View>
        <View style={styles.viewerBadge}>
          <Ionicons color={palette.textPrimary} name="play" size={10} />
          <Text style={styles.viewerBadgeText}>15.8M</Text>
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
            <View style={styles.ratingWrap}>
              <Ionicons color={palette.accentStrong} name="star" size={10} />
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
    backgroundColor: 'transparent',
  },
  cardPressed: {
    opacity: 0.92,
  },
  posterFrame: {
    aspectRatio: 0.72,
    backgroundColor: palette.surfaceRaised,
    borderRadius: 5,
    overflow: 'hidden',
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
    fontSize: 26,
    fontWeight: '700',
  },
  favoriteBadge: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderBottomLeftRadius: 4,
    backgroundColor: 'rgba(255, 64, 129, 0.86)',
  },
  popularBadgeText: {
    color: palette.textPrimary,
    fontSize: 8,
    fontWeight: '700',
  },
  viewerBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  viewerBadgeText: {
    color: palette.textPrimary,
    fontSize: 8,
    fontWeight: '700',
  },
  copyBlock: {
    marginTop: 6,
    gap: 2,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  metaText: {
    flex: 1,
    color: palette.textMuted,
    fontSize: 10,
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    color: palette.accentStrong,
    fontSize: 9,
    fontWeight: '700',
  },
});
