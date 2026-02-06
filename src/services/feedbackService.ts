import { Platform } from 'react-native';
import { supabase } from './supabase';

const GITHUB_OWNER = 'ysw505';
const GITHUB_REPO = 'fitness-log-app';
const GITHUB_TOKEN = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

/**
 * 이미지를 Supabase Storage에 업로드하고 공개 URL 반환
 */
async function uploadImageToStorage(uri: string, index: number): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const fileName = `feedback/${timestamp}-${index}.jpg`;

    if (Platform.OS === 'web') {
      // 웹: fetch로 blob 변환 후 업로드
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await supabase.storage
        .from('feedback-images')
        .upload(fileName, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
    } else {
      // 네이티브: FormData로 업로드
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: `${timestamp}-${index}.jpg`,
        type: 'image/jpeg',
      } as any);

      const { error } = await supabase.storage
        .from('feedback-images')
        .upload(fileName, formData, { contentType: 'multipart/form-data' });
      if (error) throw error;
    }

    const { data } = supabase.storage
      .from('feedback-images')
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (error) {
    console.error('이미지 업로드 실패:', error);
    return null;
  }
}

/**
 * GitHub 이슈 생성
 */
export async function submitFeedback(
  title: string,
  body: string,
  imageUris: string[],
): Promise<{ success: boolean; issueUrl?: string; error?: string }> {
  if (!GITHUB_TOKEN) {
    return { success: false, error: 'GitHub 토큰이 설정되지 않았습니다' };
  }

  try {
    // 1. 이미지 업로드
    const imageUrls: string[] = [];
    for (let i = 0; i < imageUris.length; i++) {
      const url = await uploadImageToStorage(imageUris[i], i);
      if (url) imageUrls.push(url);
    }

    // 2. 이슈 본문 생성
    let issueBody = body;
    if (imageUrls.length > 0) {
      issueBody += '\n\n---\n\n**첨부 이미지:**\n';
      imageUrls.forEach((url, i) => {
        issueBody += `\n![image-${i + 1}](${url})\n`;
      });
    }

    // 디바이스 정보 추가
    issueBody += `\n\n---\n*플랫폼: ${Platform.OS} | 앱 내 건의하기*`;

    // 3. GitHub 이슈 생성
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body: issueBody,
          labels: ['feedback'],
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const issue = await response.json();
    return { success: true, issueUrl: issue.html_url };
  } catch (error: any) {
    console.error('피드백 제출 실패:', error);
    return { success: false, error: error.message || '알 수 없는 오류' };
  }
}
