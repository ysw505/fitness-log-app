import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/services/supabase';
import { Profile } from '@/types/database.types';
import { useHistoryStore } from './historyStore';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;

  // Actions
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,

  setSession: (session) => {
    set({ session, user: session?.user ?? null });
  },

  setProfile: (profile) => {
    set({ profile });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  },

  signInWithGoogle: async () => {
    if (Platform.OS === 'web') {
      // 웹에서는 간단히 OAuth 리다이렉트
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } else {
      // 네이티브에서는 expo-web-browser 사용
      // EAS 빌드에서는 native scheme 사용
      const redirectUri = makeRedirectUri({
        scheme: 'fitnesslogtemp',
        path: 'auth/callback',
        // native: 앱 스키마로 리다이렉트
        native: 'fitnesslogtemp://auth/callback',
      });

      console.log('Redirect URI:', redirectUri);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('No URL returned');

      // 브라우저에서 인증
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri
      );

      if (result.type === 'success') {
        const url = result.url;
        // URL에서 토큰 추출 (hash fragment 또는 query params)
        let params: URLSearchParams;
        if (url.includes('#')) {
          params = new URLSearchParams(url.split('#')[1]);
        } else if (url.includes('?')) {
          params = new URLSearchParams(url.split('?')[1]);
        } else {
          throw new Error('Invalid callback URL');
        }

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }
    }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ session: null, user: null, profile: null });
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    set({ profile: data });
  },

  initialize: async () => {
    set({ isLoading: true });

    // 현재 세션 가져오기
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null });

    // 프로필 가져오기 및 동기화
    if (session?.user) {
      await get().fetchProfile();
      // 앱 시작 시 클라우드에서 운동 기록 동기화
      useHistoryStore.getState().syncFromCloud(session.user.id);
    }

    // 인증 상태 변경 리스너 설정
    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session, user: session?.user ?? null });

      if (event === 'SIGNED_IN' && session?.user) {
        await get().fetchProfile();
        // 로그인 시 클라우드에서 운동 기록 동기화
        useHistoryStore.getState().syncFromCloud(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        set({ profile: null });
      }
    });

    set({ isLoading: false });
  },
}));
