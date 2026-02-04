import React, { useState } from 'react';
import {
  StyleSheet,
  Pressable,
  Modal,
  View,
  ScrollView,
} from 'react-native';
import { Text, useThemeColors } from '@/components/Themed';
import { useProfileStore } from '@/stores/profileStore';
import { useAuthStore } from '@/stores/authStore';
import { FitnessProfile } from '@/types/database.types';

interface ProfileSwitcherProps {
  compact?: boolean; // 헤더용 컴팩트 모드
}

export function ProfileSwitcher({ compact = false }: ProfileSwitcherProps) {
  const colors = useThemeColors();
  const { profiles, currentProfileId, selectProfile, createProfile } = useProfileStore();
  const { user } = useAuthStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  const currentProfile = profiles.find((p) => p.id === currentProfileId);

  const handleSelectProfile = (profile: FitnessProfile) => {
    selectProfile(profile.id);
    setModalVisible(false);
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim() || !user) return;

    setIsCreating(true);
    try {
      const newProfile = await createProfile(user.id, newProfileName.trim());
      if (newProfile) {
        selectProfile(newProfile.id);
        setNewProfileName('');
      }
    } finally {
      setIsCreating(false);
    }
  };

  // 프로필이 1개면 스위처 표시 안함
  if (profiles.length <= 1 && !user) {
    return null;
  }

  return (
    <>
      <Pressable
        style={[
          compact ? styles.compactButton : styles.button,
          { backgroundColor: colors.cardSecondary },
        ]}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarText}>
            {currentProfile?.name?.charAt(0) || '?'}
          </Text>
        </View>
        {!compact && (
          <Text style={[styles.buttonText, { color: colors.text }]} numberOfLines={1}>
            {currentProfile?.name || '프로필 선택'}
          </Text>
        )}
        <Text style={[styles.dropdownIcon, { color: colors.textSecondary }]}>▼</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>프로필 선택</Text>

            <ScrollView style={styles.profileList}>
              {profiles.map((profile) => (
                <Pressable
                  key={profile.id}
                  style={[
                    styles.profileItem,
                    { backgroundColor: colors.cardSecondary },
                    profile.id === currentProfileId && {
                      borderColor: colors.primary,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => handleSelectProfile(profile)}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarTextLarge}>
                      {profile.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.profileInfo}>
                    <Text style={[styles.profileName, { color: colors.text }]}>
                      {profile.name}
                    </Text>
                    {profile.is_default && (
                      <Text style={[styles.defaultBadge, { color: colors.textTertiary }]}>
                        기본 프로필
                      </Text>
                    )}
                  </View>
                  {profile.id === currentProfileId && (
                    <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>

            {user && (
              <Pressable
                style={[styles.addButton, { borderColor: colors.border }]}
                onPress={() => {
                  setModalVisible(false);
                  // 프로필 탭의 관리 섹션으로 이동하거나 새 프로필 생성 모달 열기
                  // 여기서는 간단히 prompt 사용
                  const name = prompt('새 프로필 이름을 입력하세요:');
                  if (name?.trim()) {
                    createProfile(user.id, name.trim()).then((newProfile) => {
                      if (newProfile) {
                        selectProfile(newProfile.id);
                      }
                    });
                  }
                }}
              >
                <Text style={[styles.addButtonText, { color: colors.primary }]}>
                  + 새 프로필 추가
                </Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.closeButton, { backgroundColor: colors.cardSecondary }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>
                닫기
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 8,
  },
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 16,
    gap: 4,
  },
  avatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    maxWidth: 100,
  },
  dropdownIcon: {
    fontSize: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  profileList: {
    maxHeight: 300,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextLarge: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
  },
  defaultBadge: {
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '700',
  },
  addButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
