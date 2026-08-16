import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  type Auth,
} from 'firebase/auth';
import { Platform } from 'react-native';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();

if (Platform.OS !== 'web' && webClientId) {
  GoogleSignin.configure({ webClientId });
}

function codedError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

export async function signInWithGoogle(auth: Auth): Promise<boolean> {
  if (!webClientId) {
    throw codedError(
      'auth/google-client-id-missing',
      'Google Client ID chưa được cấu hình.',
    );
  }

  if (Platform.OS === 'web') {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      return true;
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error
        ? String(error.code)
        : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return false;
      }
      throw error;
    }
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return false;

    const idToken = response.data.idToken;
    if (!idToken) {
      throw codedError(
        'auth/google-id-token-missing',
        'Google không trả về ID token. Hãy kiểm tra Web Client ID.',
      );
    }

    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
    return true;
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return false;
      if (error.code === statusCodes.IN_PROGRESS) {
        throw codedError('auth/google-sign-in-in-progress', 'Đăng nhập Google đang được xử lý.');
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw codedError(
          'auth/google-play-services-unavailable',
          'Google Play Services chưa có hoặc cần được cập nhật.',
        );
      }
    }
    throw error;
  }
}

export async function signOutGoogleSession() {
  if (Platform.OS === 'web') return;
  try {
    if (GoogleSignin.getCurrentUser()) await GoogleSignin.signOut();
  } catch {
    // Firebase sign-out must still complete if the Google SDK has no active session.
  }
}
