import { useState, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, Alert, Platform, View as RNView, Modal, Switch, ScrollView } from 'react-native';
import { router } from 'expo-router';

import { Text, View, useThemeColors } from '@/components/Themed';
import { useAuthStore } from '@/stores/authStore';
import { useHistoryStore } from '@/stores/historyStore';

export default function ProfileScreen() {
  const colors = useThemeColors();
  const { user, profile, signOut, updateProfile } = useAuthStore();
  const { completedWorkouts, syncToCloud, syncFromCloud, isSyncing } = useHistoryStore();

  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingName, setEditingName] = useState(profile?.display_name || '');

  // 동적 스타일
  const dynamicStyles = useMemo(() => ({
    container: { backgroundColor: colors.background },
    card: { backgroundColor: colors.card },
    cardSecondary: { backgroundColor: colors.cardSecondary },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    textTertiary: { color: colors.textTertiary },
    primary: { color: colors.primary },
    primaryBg: { backgroundColor: colors.primary },
    border: { borderBottomColor: colors.border },
    error: { color: colors.error },
    errorBg: { backgroundColor: colors.error + '20' },
    modalBg: { backgroundColor: colors.background },
  }), [colors]);

  const handleSignOut = async () => {
    const doSignOut = async () => {
      try {
        await signOut();
        router.replace('/auth/login');
      } catch (error) {
        console.error('Sign out error:', error);
        if (Platform.OS === 'web') {
          alert('로그아웃 중 오류가 발생했습니다');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('정말 로그아웃 하시겠습니까?')) {
        await doSignOut();
      }
    } else {
      Alert.alert(
        '로그아웃',
        '정말 로그아웃 하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '로그아웃',
            style: 'destructive',
            onPress: doSignOut,
          },
        ]
      );
    }
  };

  const handleUnitChange = async (unit: 'metric' | 'imperial') => {
    if (user && updateProfile) {
      try {
        await updateProfile({ unit_system: unit });
      } catch (error) {
        console.error('Failed to update unit:', error);
      }
    }
    setShowUnitModal(false);
  };

  const handleBackup = async () => {
    if (!user) {
      if (Platform.OS === 'web') {
        alert('로그인이 필요합니다');
      } else {
        Alert.alert('알림', '로그인이 필요합니다');
      }
      return;
    }

    const doBackup = async () => {
      try {
        await syncToCloud(user.id);
        if (Platform.OS === 'web') {
          alert(`${completedWorkouts.length}개의 운동 기록이 클라우드에 백업되었습니다`);
        } else {
          Alert.alert('완료', `${completedWorkouts.length}개의 운동 기록이 클라우드에 백업되었습니다`);
        }
      } catch (error) {
        console.error('Backup failed:', error);
        if (Platform.OS === 'web') {
          alert('백업 중 오류가 발생했습니다');
        } else {
          Alert.alert('오류', '백업 중 오류가 발생했습니다');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('클라우드에 데이터를 백업하시겠습니까?')) {
        await doBackup();
      }
    } else {
      Alert.alert(
        '데이터 백업',
        '클라우드에 데이터를 백업하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '백업', onPress: doBackup },
        ]
      );
    }
  };

  const handleRestore = async () => {
    if (!user) {
      if (Platform.OS === 'web') {
        alert('로그인이 필요합니다');
      } else {
        Alert.alert('알림', '로그인이 필요합니다');
      }
      return;
    }

    const doRestore = async () => {
      try {
        await syncFromCloud(user.id);
        if (Platform.OS === 'web') {
          alert('클라우드에서 데이터를 복원했습니다');
        } else {
          Alert.alert('완료', '클라우드에서 데이터를 복원했습니다');
        }
      } catch (error) {
        console.error('Restore failed:', error);
        if (Platform.OS === 'web') {
          alert('복원 중 오류가 발생했습니다');
        } else {
          Alert.alert('오류', '복원 중 오류가 발생했습니다');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('클라우드에서 데이터를 복원하시겠습니까? 로컬 데이터와 병합됩니다.')) {
        await doRestore();
      }
    } else {
      Alert.alert(
        '데이터 복원',
        '클라우드에서 데이터를 복원하시겠습니까? 로컬 데이터와 병합됩니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '복원', onPress: doRestore },
        ]
      );
    }
  };

  const handleAppInfo = () => {
    const message = 'Fitness Log App\n버전: 1.0.0\n\n운동 기록을 쉽게 관리하세요!';
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      Alert.alert('앱 정보', message);
    }
  };

  return (
    <ScrollView
      style={[styles.container, dynamicStyles.container]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <RNView style={styles.profileHeader}>
        <RNView style={[styles.avatar, dynamicStyles.primaryBg]}>
          <Text style={styles.avatarText}>
            {profile?.display_name?.[0] || user?.email?.[0]?.toUpperCase() || '?'}
          </Text>
        </RNView>
        <Text style={[styles.displayName, dynamicStyles.text]}>
          {profile?.display_name || '이름 없음'}
        </Text>
        <Text style={[styles.email, dynamicStyles.textSecondary]}>
          {user?.email || '로그인이 필요합니다'}
        </Text>
        {!user && (
          <Text style={[styles.guestNotice, dynamicStyles.textTertiary]}>
            게스트 모드 - 데이터는 이 기기에만 저장됩니다
          </Text>
        )}
      </RNView>

      <RNView style={[styles.menuList, dynamicStyles.card]}>
        <TouchableOpacity
          style={[styles.menuItem, dynamicStyles.border]}
          onPress={() => {
            if (Platform.OS === 'web') {
              const name = prompt('표시 이름을 입력하세요', profile?.display_name || '');
              if (name !== null && updateProfile) {
                updateProfile({ display_name: name });
              }
            } else {
              setShowProfileModal(true);
            }
          }}
        >
          <Text style={[styles.menuText, dynamicStyles.text]}>프로필 수정</Text>
          <Text style={[styles.menuArrow, dynamicStyles.textTertiary]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, dynamicStyles.border]}
          onPress={() => setShowUnitModal(true)}
        >
          <Text style={[styles.menuText, dynamicStyles.text]}>단위 설정</Text>
          <Text style={[styles.menuValue, dynamicStyles.textSecondary]}>
            {profile?.unit_system === 'imperial' ? 'lb' : 'kg'} ›
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, dynamicStyles.border]}
          onPress={handleBackup}
          disabled={isSyncing}
        >
          <Text style={[styles.menuText, dynamicStyles.text]}>
            {isSyncing ? '동기화 중...' : '클라우드 백업'}
          </Text>
          <Text style={[styles.menuArrow, dynamicStyles.textTertiary]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, dynamicStyles.border]}
          onPress={handleRestore}
          disabled={isSyncing}
        >
          <Text style={[styles.menuText, dynamicStyles.text]}>
            {isSyncing ? '동기화 중...' : '클라우드에서 복원'}
          </Text>
          <Text style={[styles.menuArrow, dynamicStyles.textTertiary]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleAppInfo}>
          <Text style={[styles.menuText, dynamicStyles.text]}>앱 정보</Text>
          <Text style={[styles.menuValue, dynamicStyles.textSecondary]}>v1.0.0 ›</Text>
        </TouchableOpacity>
      </RNView>

      {/* 통계 요약 */}
      <RNView style={[styles.statsCard, dynamicStyles.card]}>
        <Text style={[styles.statsTitle, dynamicStyles.textSecondary]}>내 운동 통계</Text>
        <RNView style={styles.statsRow}>
          <RNView style={styles.statItem}>
            <Text style={[styles.statValue, dynamicStyles.primary]}>{completedWorkouts.length}</Text>
            <Text style={[styles.statLabel, dynamicStyles.textTertiary]}>총 운동</Text>
          </RNView>
          <RNView style={styles.statItem}>
            <Text style={[styles.statValue, dynamicStyles.primary]}>
              {completedWorkouts.reduce((sum, w) => sum + w.total_sets, 0)}
            </Text>
            <Text style={[styles.statLabel, dynamicStyles.textTertiary]}>총 세트</Text>
          </RNView>
          <RNView style={styles.statItem}>
            <Text style={[styles.statValue, dynamicStyles.primary]}>
              {Math.round(completedWorkouts.reduce((sum, w) => sum + w.total_volume, 0) / 1000)}k
            </Text>
            <Text style={[styles.statLabel, dynamicStyles.textTertiary]}>총 볼륨(kg)</Text>
          </RNView>
        </RNView>
      </RNView>

      {user ? (
        <TouchableOpacity style={[styles.signOutButton, dynamicStyles.errorBg]} onPress={handleSignOut}>
          <Text style={[styles.signOutText, dynamicStyles.error]}>로그아웃</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.signInButton, dynamicStyles.primaryBg]}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.signInText}>로그인 / 회원가입</Text>
        </TouchableOpacity>
      )}

      <RNView style={styles.bottomSpacer} />

      {/* 단위 설정 모달 */}
      <Modal
        visible={showUnitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnitModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowUnitModal(false)}
        >
          <RNView style={[styles.modalContent, dynamicStyles.modalBg]}>
            <Text style={[styles.modalTitle, dynamicStyles.text]}>단위 설정</Text>

            <TouchableOpacity
              style={[
                styles.unitOption,
                profile?.unit_system !== 'imperial' && dynamicStyles.primaryBg,
              ]}
              onPress={() => handleUnitChange('metric')}
            >
              <Text
                style={[
                  styles.unitOptionText,
                  profile?.unit_system !== 'imperial' ? { color: '#fff' } : dynamicStyles.text,
                ]}
              >
                킬로그램 (kg)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.unitOption,
                profile?.unit_system === 'imperial' && dynamicStyles.primaryBg,
              ]}
              onPress={() => handleUnitChange('imperial')}
            >
              <Text
                style={[
                  styles.unitOptionText,
                  profile?.unit_system === 'imperial' ? { color: '#fff' } : dynamicStyles.text,
                ]}
              >
                파운드 (lb)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowUnitModal(false)}
            >
              <Text style={[styles.modalCancelText, dynamicStyles.textSecondary]}>취소</Text>
            </TouchableOpacity>
          </RNView>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  bottomSpacer: {
    height: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
  },
  guestNotice: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  menuList: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  menuText: {
    fontSize: 16,
  },
  menuValue: {
    fontSize: 14,
  },
  menuArrow: {
    fontSize: 18,
  },
  statsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  signOutButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  signInButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  signInText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  unitOption: {
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  unitOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalCancel: {
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 15,
  },
});
