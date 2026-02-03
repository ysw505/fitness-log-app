import { useState, useMemo } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  View as RNView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';

import { Text, View, useThemeColors } from '@/components/Themed';
import { useAuthStore } from '@/stores/authStore';

export default function LoginScreen() {
  const colors = useThemeColors();
  const { signIn, signUp, signInWithGoogle } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // 동적 스타일
  const dynamicStyles = useMemo(() => ({
    container: { backgroundColor: colors.background },
    card: { backgroundColor: colors.card },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    textTertiary: { color: colors.textTertiary },
    primary: { color: colors.primary },
    primaryBg: { backgroundColor: colors.primary },
    border: { borderColor: colors.border },
    input: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.text,
    },
  }), [colors]);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert('오류', '이메일과 비밀번호를 입력해주세요');
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
        Alert.alert('성공', '회원가입 완료! 이메일을 확인해주세요.');
      } else {
        await signIn(email, password);
        router.replace('/');
      }
    } catch (error: any) {
      Alert.alert('오류', error.message || '인증에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      // 웹에서는 리다이렉트되므로 여기서 끝남
      // 네이티브에서는 콜백에서 처리됨
    } catch (error: any) {
      Alert.alert('오류', error.message || 'Google 로그인에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, dynamicStyles.container]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <RNView style={styles.header}>
          <Text style={[styles.title, dynamicStyles.text]}>운동 기록</Text>
          <Text style={[styles.subtitle, dynamicStyles.textSecondary]}>
            {isSignUp ? '계정을 만들어 시작하세요' : '로그인하여 운동 기록을 동기화하세요'}
          </Text>
        </RNView>

        {/* Google 로그인 버튼 */}
        <TouchableOpacity
          style={[styles.googleButton, dynamicStyles.card, dynamicStyles.border]}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
        >
          <Text style={styles.googleIcon}>G</Text>
          <Text style={[styles.googleText, dynamicStyles.text]}>
            Google로 계속하기
          </Text>
        </TouchableOpacity>

        {/* 구분선 */}
        <RNView style={styles.divider}>
          <RNView style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, dynamicStyles.textTertiary]}>또는</Text>
          <RNView style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </RNView>

        {/* 이메일/비밀번호 입력 */}
        <RNView style={styles.form}>
          <TextInput
            style={[styles.input, dynamicStyles.input]}
            placeholder="이메일"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={[styles.input, dynamicStyles.input]}
            placeholder="비밀번호"
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.submitButton, dynamicStyles.primaryBg]}
            onPress={handleEmailAuth}
            disabled={isLoading}
          >
            <Text style={styles.submitText}>
              {isLoading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
            </Text>
          </TouchableOpacity>
        </RNView>

        {/* 회원가입/로그인 전환 */}
        <TouchableOpacity
          style={styles.switchMode}
          onPress={() => setIsSignUp(!isSignUp)}
        >
          <Text style={dynamicStyles.textSecondary}>
            {isSignUp ? '이미 계정이 있으신가요? ' : '계정이 없으신가요? '}
          </Text>
          <Text style={dynamicStyles.primary}>
            {isSignUp ? '로그인' : '회원가입'}
          </Text>
        </TouchableOpacity>

        {/* 게스트 모드 */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace('/')}
        >
          <Text style={dynamicStyles.textTertiary}>나중에 할게요</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  googleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  form: {
    gap: 12,
  },
  input: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchMode: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  skipButton: {
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
  },
});
