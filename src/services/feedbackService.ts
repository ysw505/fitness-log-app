import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const GITHUB_OWNER = 'ysw505';
const GITHUB_REPO = 'fitness-log-app';
const GITHUB_TOKEN = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

/**
 * 이미지를 base64로 변환
 */
async function imageToBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    // 네이티브: expo-file-system으로 안정적 base64 변환
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  }
}

/**
 * 이미지를 GitHub 레포에 업로드하고 raw URL 반환
 */
async function uploadImageToGitHub(uri: string, index: number): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const fileName = `feedback-images/${timestamp}-${index}.jpg`;
    const base64Content = await imageToBase64(uri);

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${fileName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `feedback image ${timestamp}-${index}`,
          content: base64Content,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.content.download_url;
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
      const url = await uploadImageToGitHub(imageUris[i], i);
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
