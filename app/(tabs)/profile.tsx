import { useState, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, Alert, Platform, View as RNView, Modal, Switch, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';

import { Text, View, useThemeColors } from '@/components/Themed';
import { useAuthStore } from '@/stores/authStore';
import { useHistoryStore, CompletedWorkout } from '@/stores/historyStore';
import { useProfileStore, REP_RANGES, RepRangeType } from '@/stores/profileStore';
import { useBodyCompositionStore, calculateBMI, getBMICategory } from '@/stores/bodyCompositionStore';
import { FitnessProfile } from '@/types/database.types';

// CSV 생성 함수
const generateWorkoutCSV = (workouts: CompletedWorkout[]): string => {
  const headers = ['날짜', '시간', '운동이름', '세트', '무게(kg)', '횟수', 'RPE', '볼륨(kg)'];
  const rows: string[][] = [];

  workouts.forEach((workout) => {
    const date = new Date(workout.finished_at);
    const dateStr = date.toLocaleDateString('ko-KR');
    const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

    workout.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        const volume = (set.weight || 0) * (set.reps || 0);
        rows.push([
          dateStr,
          timeStr,
          exercise.exercise.name_ko || exercise.exercise.name,
          set.set_number.toString(),
          (set.weight || 0).toString(),
          (set.reps || 0).toString(),
          set.rpe?.toString() || '',
          volume.toString(),
        ]);
      });
    });
  });

  // BOM for Excel compatibility
  const bom = '\uFEFF';
  const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
  return bom + csvContent;
};

// 웹에서 파일 다운로드
const downloadCSV = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function ProfileScreen() {
  const colors = useThemeColors();
  const { user, profile, signOut, updateProfile } = useAuthStore();
  const { completedWorkouts, syncToCloud, syncFromCloud, isSyncing, clearAllHistory } = useHistoryStore();
  const {
    profiles: fitnessProfiles,
    currentProfileId,
    selectProfile,
    createProfile,
    updateProfile: updateFitnessProfile,
    deleteProfile,
    repRangePreference,
    setRepRangePreference,
  } = useProfileStore();

  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingName, setEditingName] = useState(profile?.display_name || '');

  // 피트니스 프로필 관리
  const [showFitnessProfileModal, setShowFitnessProfileModal] = useState(false);
  const [editingFitnessProfile, setEditingFitnessProfile] = useState<FitnessProfile | null>(null);
  const [newFitnessProfileName, setNewFitnessProfileName] = useState('');
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  // 체성분 관리
  const {
    getLatest: getLatestBodyComp,
    getPrevious: getPreviousBodyComp,
    addRecord: addBodyCompRecord,
    defaultHeight,
    setDefaultHeight,
  } = useBodyCompositionStore();
  const [showBodyCompModal, setShowBodyCompModal] = useState(false);
  const [bodyCompWeight, setBodyCompWeight] = useState('');
  const [bodyCompBodyFat, setBodyCompBodyFat] = useState('');
  const [bodyCompMuscleMass, setBodyCompMuscleMass] = useState('');
  const [bodyCompHeight, setBodyCompHeight] = useState('');

  const latestBodyComp = getLatestBodyComp();
  const previousBodyComp = getPreviousBodyComp();

  const currentFitnessProfile = fitnessProfiles.find((p) => p.id === currentProfileId);

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

  const handleExportCSV = () => {
    if (completedWorkouts.length === 0) {
      if (Platform.OS === 'web') {
        alert('내보낼 운동 기록이 없습니다');
      } else {
        Alert.alert('알림', '내보낼 운동 기록이 없습니다');
      }
      return;
    }

    if (Platform.OS === 'web') {
      const csv = generateWorkoutCSV(completedWorkouts);
      const filename = `fitness-log-${new Date().toISOString().split('T')[0]}.csv`;
      downloadCSV(csv, filename);
      alert(`${completedWorkouts.length}개의 운동 기록이 CSV 파일로 내보내졌습니다`);
    } else {
      // 모바일: 클립보드나 공유 기능이 필요 (expo-sharing 설치 필요)
      // 현재는 웹에서만 지원
      Alert.alert(
        '알림',
        'CSV 내보내기는 현재 웹에서만 지원됩니다.\n\n웹 브라우저에서 앱에 접속하여 내보내기를 진행해주세요.',
        [{ text: '확인' }]
      );
    }
  };

  const handleClearAllHistory = () => {
    if (completedWorkouts.length === 0) {
      if (Platform.OS === 'web') {
        alert('삭제할 기록이 없습니다');
      } else {
        Alert.alert('알림', '삭제할 기록이 없습니다');
      }
      return;
    }

    const doClear = () => {
      clearAllHistory();
      if (Platform.OS === 'web') {
        alert('모든 운동 기록이 삭제되었습니다');
      } else {
        Alert.alert('완료', '모든 운동 기록이 삭제되었습니다');
      }
    };

    if (Platform.OS === 'web') {
      if (confirm(`정말 모든 운동 기록(${completedWorkouts.length}개)을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
        doClear();
      }
    } else {
      Alert.alert(
        '전체 기록 초기화',
        `정말 모든 운동 기록(${completedWorkouts.length}개)을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
        [
          { text: '취소', style: 'cancel' },
          { text: '삭제', style: 'destructive', onPress: doClear },
        ]
      );
    }
  };

  // 피트니스 프로필 생성
  const handleCreateFitnessProfile = async () => {
    if (!newFitnessProfileName.trim()) return;
    if (!user) {
      if (Platform.OS === 'web') {
        alert('로그인이 필요합니다');
      } else {
        Alert.alert('알림', '로그인이 필요합니다');
      }
      return;
    }

    setIsCreatingProfile(true);
    try {
      const newProfile = await createProfile(user.id, newFitnessProfileName.trim());
      if (newProfile) {
        setNewFitnessProfileName('');
        selectProfile(newProfile.id);
      }
    } finally {
      setIsCreatingProfile(false);
    }
  };

  // 피트니스 프로필 삭제
  const handleDeleteFitnessProfile = (profileToDelete: FitnessProfile) => {
    if (profileToDelete.is_default) {
      if (Platform.OS === 'web') {
        alert('기본 프로필은 삭제할 수 없습니다');
      } else {
        Alert.alert('알림', '기본 프로필은 삭제할 수 없습니다');
      }
      return;
    }

    if (fitnessProfiles.length <= 1) {
      if (Platform.OS === 'web') {
        alert('최소 1개의 프로필이 필요합니다');
      } else {
        Alert.alert('알림', '최소 1개의 프로필이 필요합니다');
      }
      return;
    }

    const doDelete = () => {
      deleteProfile(profileToDelete.id);
    };

    if (Platform.OS === 'web') {
      if (confirm(`"${profileToDelete.name}" 프로필을 삭제하시겠습니까? 이 프로필의 모든 운동 기록이 함께 삭제됩니다.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        '프로필 삭제',
        `"${profileToDelete.name}" 프로필을 삭제하시겠습니까?\n이 프로필의 모든 운동 기록이 함께 삭제됩니다.`,
        [
          { text: '취소', style: 'cancel' },
          { text: '삭제', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  // 피트니스 프로필 이름 수정
  const handleUpdateFitnessProfileName = (profileToUpdate: FitnessProfile, newName: string) => {
    if (!newName.trim()) return;
    updateFitnessProfile(profileToUpdate.id, { name: newName.trim() });
  };

  // 체성분 기록 추가
  const handleAddBodyCompRecord = () => {
    const weight = parseFloat(bodyCompWeight);
    const bodyFat = bodyCompBodyFat ? parseFloat(bodyCompBodyFat) : undefined;
    const muscleMass = bodyCompMuscleMass ? parseFloat(bodyCompMuscleMass) : undefined;
    const height = bodyCompHeight ? parseFloat(bodyCompHeight) : undefined;

    if (isNaN(weight) || weight <= 0) {
      if (Platform.OS === 'web') {
        alert('체중을 입력해주세요');
      } else {
        Alert.alert('알림', '체중을 입력해주세요');
      }
      return;
    }

    addBodyCompRecord({
      date: new Date().toISOString(),
      weight,
      bodyFat: bodyFat && !isNaN(bodyFat) ? bodyFat : undefined,
      muscleMass: muscleMass && !isNaN(muscleMass) ? muscleMass : undefined,
      height: height && !isNaN(height) ? height : undefined,
    });

    // 입력 필드 초기화
    setBodyCompWeight('');
    setBodyCompBodyFat('');
    setBodyCompMuscleMass('');
    setBodyCompHeight('');
    setShowBodyCompModal(false);

    if (Platform.OS === 'web') {
      alert('체성분 기록이 저장되었습니다');
    } else {
      Alert.alert('완료', '체성분 기록이 저장되었습니다');
    }
  };

  // 체성분 트렌드 계산
  const getBodyCompTrend = (current?: number, previous?: number): 'up' | 'down' | 'same' | null => {
    if (current === undefined || previous === undefined) return null;
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'same';
  };

  const weightTrend = getBodyCompTrend(latestBodyComp?.weight, previousBodyComp?.weight);
  const bodyFatTrend = getBodyCompTrend(latestBodyComp?.bodyFat, previousBodyComp?.bodyFat);

  const renderTrendArrow = (trend: 'up' | 'down' | 'same' | null, inverted = false) => {
    if (!trend || trend === 'same') return null;
    // inverted: true면 down이 좋은 것 (체지방)
    const isPositive = inverted ? trend === 'down' : trend === 'up';
    return (
      <Text style={[styles.trendArrow, { color: isPositive ? colors.success : colors.error }]}>
        {trend === 'up' ? '↑' : '↓'}
      </Text>
    );
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

        <TouchableOpacity
          style={[styles.menuItem, dynamicStyles.border]}
          onPress={handleExportCSV}
        >
          <Text style={[styles.menuText, dynamicStyles.text]}>CSV 내보내기</Text>
          <Text style={[styles.menuValue, dynamicStyles.textSecondary]}>
            {completedWorkouts.length}개 기록 ›
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, dynamicStyles.border]}
          onPress={handleClearAllHistory}
        >
          <Text style={[styles.menuText, dynamicStyles.error]}>전체 기록 초기화</Text>
          <Text style={[styles.menuArrow, dynamicStyles.textTertiary]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleAppInfo}>
          <Text style={[styles.menuText, dynamicStyles.text]}>앱 정보</Text>
          <Text style={[styles.menuValue, dynamicStyles.textSecondary]}>v1.0.0 ›</Text>
        </TouchableOpacity>
      </RNView>

      {/* 체성분 관리 */}
      <RNView style={[styles.sectionCard, dynamicStyles.card]}>
        <RNView style={styles.sectionHeader}>
          <RNView>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>체성분</Text>
            <Text style={[styles.sectionSubtitle, dynamicStyles.textTertiary]}>
              체중, 체지방률, 근육량 변화를 기록하세요
            </Text>
          </RNView>
          <TouchableOpacity
            style={[styles.recordButton, dynamicStyles.primaryBg]}
            onPress={() => {
              // 기존 키 값이 있으면 미리 채우기
              if (defaultHeight) {
                setBodyCompHeight(defaultHeight.toString());
              }
              setShowBodyCompModal(true);
            }}
          >
            <Text style={styles.recordButtonText}>기록</Text>
          </TouchableOpacity>
        </RNView>

        {latestBodyComp ? (
          <RNView style={styles.bodyCompStats}>
            <RNView style={[styles.bodyCompStatItem, dynamicStyles.cardSecondary]}>
              <Text style={[styles.bodyCompStatLabel, dynamicStyles.textTertiary]}>체중</Text>
              <RNView style={styles.bodyCompStatValueRow}>
                <Text style={[styles.bodyCompStatValue, dynamicStyles.text]}>
                  {latestBodyComp.weight?.toFixed(1) || '-'}
                </Text>
                <Text style={[styles.bodyCompStatUnit, dynamicStyles.textTertiary]}>kg</Text>
                {renderTrendArrow(weightTrend)}
              </RNView>
            </RNView>

            <RNView style={[styles.bodyCompStatItem, dynamicStyles.cardSecondary]}>
              <Text style={[styles.bodyCompStatLabel, dynamicStyles.textTertiary]}>체지방률</Text>
              <RNView style={styles.bodyCompStatValueRow}>
                <Text style={[styles.bodyCompStatValue, dynamicStyles.text]}>
                  {latestBodyComp.bodyFat?.toFixed(1) || '-'}
                </Text>
                <Text style={[styles.bodyCompStatUnit, dynamicStyles.textTertiary]}>%</Text>
                {renderTrendArrow(bodyFatTrend, true)}
              </RNView>
            </RNView>

            {latestBodyComp.weight && (latestBodyComp.height || defaultHeight) && (
              <RNView style={[styles.bodyCompStatItem, dynamicStyles.cardSecondary]}>
                <Text style={[styles.bodyCompStatLabel, dynamicStyles.textTertiary]}>BMI</Text>
                <RNView style={styles.bodyCompStatValueRow}>
                  <Text style={[styles.bodyCompStatValue, dynamicStyles.text]}>
                    {calculateBMI(latestBodyComp.weight, latestBodyComp.height || defaultHeight || 0).toFixed(1)}
                  </Text>
                  <Text style={[styles.bodyCompStatUnit, dynamicStyles.textTertiary]}>
                    {getBMICategory(calculateBMI(latestBodyComp.weight, latestBodyComp.height || defaultHeight || 0))}
                  </Text>
                </RNView>
              </RNView>
            )}

            <Text style={[styles.bodyCompDate, dynamicStyles.textTertiary]}>
              마지막 기록: {new Date(latestBodyComp.date).toLocaleDateString('ko-KR')}
            </Text>
          </RNView>
        ) : (
          <RNView style={[styles.bodyCompEmpty, dynamicStyles.cardSecondary]}>
            <Text style={[styles.bodyCompEmptyText, dynamicStyles.textTertiary]}>
              아직 기록이 없습니다.{'\n'}위의 '기록' 버튼을 눌러 체성분을 기록해보세요.
            </Text>
          </RNView>
        )}
      </RNView>

      {/* 피트니스 프로필 관리 */}
      <RNView style={[styles.sectionCard, dynamicStyles.card]}>
        <Text style={[styles.sectionTitle, dynamicStyles.text]}>피트니스 프로필</Text>
        <Text style={[styles.sectionSubtitle, dynamicStyles.textTertiary]}>
          여러 사람의 운동 기록을 관리하세요 (예: 나, 여자친구)
        </Text>

        {/* 현재 선택된 프로필 */}
        <RNView style={styles.currentProfileSection}>
          <Text style={[styles.currentProfileLabel, dynamicStyles.textSecondary]}>현재 프로필</Text>
          <RNView style={[styles.currentProfileBadge, { backgroundColor: colors.primaryLight }]}>
            <RNView style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.profileAvatarText}>
                {currentFitnessProfile?.name?.charAt(0) || '?'}
              </Text>
            </RNView>
            <Text style={[styles.currentProfileName, { color: colors.primary }]}>
              {currentFitnessProfile?.name || '프로필 없음'}
            </Text>
          </RNView>
        </RNView>

        {/* 프로필 목록 */}
        <RNView style={styles.profileList}>
          {fitnessProfiles.map((fitnessProfile) => (
            <RNView
              key={fitnessProfile.id}
              style={[
                styles.profileItem,
                dynamicStyles.cardSecondary,
                fitnessProfile.id === currentProfileId && { borderColor: colors.primary, borderWidth: 2 },
              ]}
            >
              <TouchableOpacity
                style={styles.profileItemContent}
                onPress={() => selectProfile(fitnessProfile.id)}
              >
                <RNView style={[styles.profileItemAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.profileItemAvatarText}>
                    {fitnessProfile.name.charAt(0)}
                  </Text>
                </RNView>
                <RNView style={styles.profileItemInfo}>
                  <Text style={[styles.profileItemName, dynamicStyles.text]}>
                    {fitnessProfile.name}
                  </Text>
                  {fitnessProfile.is_default && (
                    <Text style={[styles.profileItemBadge, dynamicStyles.textTertiary]}>
                      기본 프로필
                    </Text>
                  )}
                </RNView>
                {fitnessProfile.id === currentProfileId && (
                  <Text style={[styles.profileItemCheck, { color: colors.primary }]}>✓</Text>
                )}
              </TouchableOpacity>

              {!fitnessProfile.is_default && (
                <RNView style={styles.profileItemActions}>
                  <TouchableOpacity
                    style={styles.profileItemAction}
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        const newName = prompt('프로필 이름 수정', fitnessProfile.name);
                        if (newName) handleUpdateFitnessProfileName(fitnessProfile, newName);
                      } else {
                        setEditingFitnessProfile(fitnessProfile);
                        setShowFitnessProfileModal(true);
                      }
                    }}
                  >
                    <Text style={[styles.profileItemActionText, dynamicStyles.textSecondary]}>수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.profileItemAction}
                    onPress={() => handleDeleteFitnessProfile(fitnessProfile)}
                  >
                    <Text style={[styles.profileItemActionText, { color: colors.error }]}>삭제</Text>
                  </TouchableOpacity>
                </RNView>
              )}
            </RNView>
          ))}
        </RNView>

        {/* 새 프로필 추가 */}
        {user && (
          <RNView style={styles.addProfileSection}>
            <TextInput
              style={[styles.addProfileInput, dynamicStyles.cardSecondary, { color: colors.text }]}
              placeholder="새 프로필 이름 (예: 여자친구)"
              placeholderTextColor={colors.textTertiary}
              value={newFitnessProfileName}
              onChangeText={setNewFitnessProfileName}
            />
            <TouchableOpacity
              style={[styles.addProfileButton, dynamicStyles.primaryBg, !newFitnessProfileName.trim() && { opacity: 0.5 }]}
              onPress={handleCreateFitnessProfile}
              disabled={!newFitnessProfileName.trim() || isCreatingProfile}
            >
              <Text style={styles.addProfileButtonText}>
                {isCreatingProfile ? '추가 중...' : '추가'}
              </Text>
            </TouchableOpacity>
          </RNView>
        )}

        {!user && (
          <Text style={[styles.loginNotice, dynamicStyles.textTertiary]}>
            로그인하면 여러 프로필을 추가할 수 있습니다
          </Text>
        )}
      </RNView>

      {/* 목표 횟수 범위 설정 */}
      <RNView style={[styles.sectionCard, dynamicStyles.card]}>
        <Text style={[styles.sectionTitle, dynamicStyles.text]}>목표 횟수 범위</Text>
        <Text style={[styles.sectionSubtitle, dynamicStyles.textTertiary]}>
          운동 추천 시 사용할 목표 반복 횟수를 설정하세요
        </Text>

        <RNView style={styles.repRangeOptions}>
          {(Object.keys(REP_RANGES) as RepRangeType[]).map((rangeType) => {
            const range = REP_RANGES[rangeType];
            const isSelected = repRangePreference === rangeType;
            return (
              <TouchableOpacity
                key={rangeType}
                style={[
                  styles.repRangeOption,
                  dynamicStyles.cardSecondary,
                  isSelected && { borderColor: colors.primary, borderWidth: 2 },
                ]}
                onPress={() => setRepRangePreference(rangeType)}
              >
                <RNView style={styles.repRangeOptionHeader}>
                  <Text style={[styles.repRangeOptionLabel, dynamicStyles.text, isSelected && { color: colors.primary }]}>
                    {range.label}
                  </Text>
                  {isSelected && (
                    <Text style={[styles.repRangeCheck, { color: colors.primary }]}>✓</Text>
                  )}
                </RNView>
                <Text style={[styles.repRangeOptionRange, dynamicStyles.textTertiary]}>
                  {range.min}-{range.max}회 / 세트
                </Text>
                <Text style={[styles.repRangeOptionDesc, dynamicStyles.textTertiary]}>
                  {rangeType === 'strength' && '높은 무게, 낮은 횟수로 최대 근력 향상'}
                  {rangeType === 'hypertrophy' && '근육 성장에 최적화된 범위'}
                  {rangeType === 'endurance' && '낮은 무게, 높은 횟수로 근지구력 향상'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </RNView>
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

      {/* 체성분 기록 모달 */}
      <Modal
        visible={showBodyCompModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBodyCompModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBodyCompModal(false)}
        >
          <RNView
            style={[styles.bodyCompModalContent, dynamicStyles.modalBg]}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, dynamicStyles.text]}>체성분 기록</Text>

            <RNView style={styles.bodyCompInputGroup}>
              <Text style={[styles.bodyCompInputLabel, dynamicStyles.textSecondary]}>
                체중 (kg) *
              </Text>
              <TextInput
                style={[styles.bodyCompInput, dynamicStyles.cardSecondary, { color: colors.text }]}
                placeholder="예: 70.5"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={bodyCompWeight}
                onChangeText={setBodyCompWeight}
              />
            </RNView>

            <RNView style={styles.bodyCompInputGroup}>
              <Text style={[styles.bodyCompInputLabel, dynamicStyles.textSecondary]}>
                체지방률 (%)
              </Text>
              <TextInput
                style={[styles.bodyCompInput, dynamicStyles.cardSecondary, { color: colors.text }]}
                placeholder="예: 15.0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={bodyCompBodyFat}
                onChangeText={setBodyCompBodyFat}
              />
            </RNView>

            <RNView style={styles.bodyCompInputGroup}>
              <Text style={[styles.bodyCompInputLabel, dynamicStyles.textSecondary]}>
                근육량 (kg)
              </Text>
              <TextInput
                style={[styles.bodyCompInput, dynamicStyles.cardSecondary, { color: colors.text }]}
                placeholder="예: 32.0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={bodyCompMuscleMass}
                onChangeText={setBodyCompMuscleMass}
              />
            </RNView>

            <RNView style={styles.bodyCompInputGroup}>
              <Text style={[styles.bodyCompInputLabel, dynamicStyles.textSecondary]}>
                키 (cm) - BMI 계산용
              </Text>
              <TextInput
                style={[styles.bodyCompInput, dynamicStyles.cardSecondary, { color: colors.text }]}
                placeholder="예: 175"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={bodyCompHeight}
                onChangeText={setBodyCompHeight}
              />
            </RNView>

            <RNView style={styles.bodyCompModalButtons}>
              <TouchableOpacity
                style={[styles.bodyCompModalButton, dynamicStyles.cardSecondary]}
                onPress={() => setShowBodyCompModal(false)}
              >
                <Text style={[styles.bodyCompModalButtonText, dynamicStyles.textSecondary]}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bodyCompModalButton, dynamicStyles.primaryBg]}
                onPress={handleAddBodyCompRecord}
              >
                <Text style={styles.bodyCompModalButtonTextPrimary}>저장</Text>
              </TouchableOpacity>
            </RNView>
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

  // 피트니스 프로필 섹션
  sectionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  currentProfileSection: {
    marginBottom: 16,
  },
  currentProfileLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  currentProfileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    gap: 10,
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  currentProfileName: {
    fontSize: 16,
    fontWeight: '600',
  },
  profileList: {
    gap: 8,
    marginBottom: 16,
  },
  profileItem: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  profileItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  profileItemAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileItemAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  profileItemInfo: {
    flex: 1,
  },
  profileItemName: {
    fontSize: 15,
    fontWeight: '500',
  },
  profileItemBadge: {
    fontSize: 11,
    marginTop: 2,
  },
  profileItemCheck: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileItemActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  profileItemAction: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  profileItemActionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  addProfileSection: {
    flexDirection: 'row',
    gap: 8,
  },
  addProfileInput: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  addProfileButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addProfileButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loginNotice: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // 목표 횟수 범위 스타일
  repRangeOptions: {
    gap: 10,
  },
  repRangeOption: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  repRangeOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  repRangeOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  repRangeCheck: {
    fontSize: 18,
    fontWeight: '700',
  },
  repRangeOptionRange: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  repRangeOptionDesc: {
    fontSize: 12,
    lineHeight: 16,
  },

  // 체성분 섹션
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  recordButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bodyCompStats: {
    gap: 10,
  },
  bodyCompStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
  },
  bodyCompStatLabel: {
    fontSize: 14,
  },
  bodyCompStatValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  bodyCompStatValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  bodyCompStatUnit: {
    fontSize: 14,
  },
  trendArrow: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 4,
  },
  bodyCompDate: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  bodyCompEmpty: {
    padding: 24,
    borderRadius: 10,
    alignItems: 'center',
  },
  bodyCompEmptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // 체성분 모달
  bodyCompModalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
  },
  bodyCompInputGroup: {
    marginBottom: 16,
  },
  bodyCompInputLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  bodyCompInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  bodyCompModalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  bodyCompModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  bodyCompModalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  bodyCompModalButtonTextPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
