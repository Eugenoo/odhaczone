import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** True once the Supabase URL and public key are configured; the app stays fully local until then. */
export const cloudConfigured = !!url && !!key;

export const supabase = createClient(url ?? 'http://localhost', key ?? 'not-configured', {
  auth: {
    storage: AsyncStorage, // localStorage on web, native storage on iOS/Android
    persistSession: true,
    autoRefreshToken: true,
    // On web the sign-in link / OAuth redirect lands back on the page with the session in the URL.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Only refresh tokens while the app is in the foreground (recommended by Supabase for React Native).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
