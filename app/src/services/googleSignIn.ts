import Constants from 'expo-constants';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

import { firebaseAuth } from '@/config/firebase';

WebBrowser.maybeCompleteAuthSession();

const extra = Constants.expoConfig?.extra ?? {};

export function useGoogleSignIn() {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: extra.googleWebClientId as string,
    iosClientId: extra.googleIosClientId as string,
    androidClientId: extra.googleAndroidClientId as string,
  });

  async function handleResponseToken() {
    if (response?.type !== 'success') return null;
    const idToken = response.params.id_token;
    if (!idToken) return null;
    const credential = GoogleAuthProvider.credential(idToken);
    return signInWithCredential(firebaseAuth, credential);
  }

  return {
    ready: !!request,
    response,
    signIn: () => promptAsync(),
    exchangeResponseForFirebaseUser: handleResponseToken,
  };
}
