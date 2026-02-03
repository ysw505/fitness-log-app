import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { useAuthStore } from '@/stores/authStore';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const { initialize } = useAuthStore();

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      initialize().then(() => {
        SplashScreen.hideAsync();
      });
    }
  }, [loaded, initialize]);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="workout/active"
          options={{
            title: '운동 중',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="workout/[id]"
          options={{
            title: '운동 상세',
          }}
        />
        <Stack.Screen
          name="workout/exercises"
          options={{
            title: '운동 선택',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="workout/add-exercise"
          options={{
            title: '새 운동 추가',
          }}
        />
        <Stack.Screen
          name="workout/templates"
          options={{
            title: '운동 템플릿',
          }}
        />
        <Stack.Screen
          name="auth/login"
          options={{
            title: '로그인',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="auth/register"
          options={{
            title: '회원가입',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
