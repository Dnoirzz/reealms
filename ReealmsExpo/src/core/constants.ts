import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { ContentSource } from '../data/models/media';

export const appConstants = {
  appName: 'Reealms',
  captainBaseUrl: 'https://captain.sapimu.au',
  dramaboxBaseUrl: 'https://dramabox.sansekai.my.id/api/dramabox',
  dramaboxWebBaseUrl: 'https://www.dramaboxdb.com',
  komikBaseUrl: 'https://api.sansekai.my.id/api',
  animeBaseUrl: 'https://otakudesu-unofficial-api.vercel.app/v1',
  defaultCaptainToken:
    process.env.EXPO_PUBLIC_CAPTAIN_TOKEN ??
    'b0cb1c3e8b2ddc08fd24c05e094a33b24625d334b3ca2cca0edf3a08b102b9c9',
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    'https://nuyhtbnmmbrnyjznvwqa.supabase.co',
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51eWh0Ym5tbWJybnlqem52d3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjU1OTAsImV4cCI6MjA4ODIwMTU5MH0.8Hp_H--1cUzPcTddibHq0E1jUFqmCd7I4seBhatRf38',
};

export const storageKeys = {
  history: 'watch_history',
  favorites: 'favorites',
} as const;

export type SourceOption = {
  id: Extract<ContentSource, 'dramabox' | 'otakudesu' | 'komik'>;
  label: string;
  blurb: string;
  accent: string;
  icon: ComponentProps<typeof Ionicons>['name'];
};

export const sourceOptions: SourceOption[] = [
  {
    id: 'dramabox',
    label: 'Drama',
    blurb: 'Short-form stories from Dramabox.',
    accent: '#F38A64',
    icon: 'film-outline',
  },
  {
    id: 'otakudesu',
    label: 'Anime',
    blurb: 'Ongoing anime listings from Otakudesu.',
    accent: '#44C6D9',
    icon: 'sparkles-outline',
  },
  {
    id: 'komik',
    label: 'Komik',
    blurb: 'Latest comic releases and chapter lists.',
    accent: '#E9B75A',
    icon: 'book-outline',
  },
];

export type AppTab = 'home' | 'search' | 'history' | 'profile';

export const tabOptions: Array<{
  id: AppTab;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}> = [
  { id: 'home', label: 'Beranda', icon: 'home-outline' },
  { id: 'search', label: 'Jelajah', icon: 'search-outline' },
  { id: 'history', label: 'Koleksi', icon: 'albums-outline' },
  { id: 'profile', label: 'Profil', icon: 'person-outline' },
];

export const migrationStatus = [
  'Ported: Expo shell, source switching, home feed, search, history, favorites, and auth wiring.',
  'Pending: detail screen, video player, anime WebView flow, comic reader, and deeper source parity.',
];
