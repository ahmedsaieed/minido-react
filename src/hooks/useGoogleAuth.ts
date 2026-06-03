// Google sign-in hook built on `expo-auth-session`.
//
// Flow:
// 1. promptAsync() opens the browser for the user to consent.
// 2. We get back an authorization code + PKCE verifier.
// 3. Exchange that for an access_token + refresh_token at Google's token
//    endpoint (no client_secret needed — PKCE on Android, PKCE on web).
// 4. Fetch the user's email/name once for display.
// 5. Persist via googleAuth.saveTokens.

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  clearTokens,
  clientIdForCurrentPlatform,
  fetchUserInfo,
  getGoogleAuthConfig,
  GoogleUser,
  loadTokens,
  revokeToken,
  saveTokens,
  Tokens,
} from '../services/googleAuth';

// Required for the browser-based flow to complete on web reload.
WebBrowser.maybeCompleteAuthSession();

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

const SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/drive.appdata',
];

export interface UseGoogleAuth {
  ready: boolean;            // hook has finished its initial load
  isSignedIn: boolean;
  user: GoogleUser | undefined;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

export function useGoogleAuth(): UseGoogleAuth {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = getGoogleAuthConfig();

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: config.androidClientId,
    iosClientId: config.iosClientId,
    webClientId: config.webClientId,
    scopes: SCOPES,
    responseType: 'code',
    // Asks Google for a refresh token. `prompt=consent` makes sure the
    // user re-consents every time so we actually get one (Google
    // suppresses re-consent silently otherwise on subsequent signs-ins).
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });

  // Initial load: do we already have stored tokens?
  useEffect(() => {
    (async () => {
      try {
        const t = await loadTokens();
        setTokens(t);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // When the OAuth round-trip returns, exchange the auth code for tokens.
  useEffect(() => {
    (async () => {
      if (!response || !request) return;
      if (response.type !== 'success') {
        if (response.type === 'error') setError(response.error?.message ?? 'Sign-in failed');
        return;
      }
      const code = response.params?.code;
      if (!code) {
        setError('No authorization code returned');
        return;
      }
      const clientId = clientIdForCurrentPlatform();
      if (!clientId) {
        setError('No Google client_id configured for this platform');
        return;
      }

      try {
        const result = await AuthSession.exchangeCodeAsync(
          {
            clientId,
            code,
            redirectUri: request.redirectUri,
            extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
          },
          { tokenEndpoint: TOKEN_ENDPOINT },
        );

        const accessToken = result.accessToken;
        const refreshToken = result.refreshToken ?? null;
        const expiresAt = Date.now() + (result.expiresIn ?? 3600) * 1000;
        const scope = result.scope ?? SCOPES.join(' ');

        let user: GoogleUser | undefined;
        try {
          user = await fetchUserInfo(accessToken);
        } catch (e) {
          console.warn('[useGoogleAuth] userinfo failed', e);
        }

        const next: Tokens = { accessToken, refreshToken, expiresAt, scope, user };
        await saveTokens(next);
        setTokens(next);
        setError(null);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      }
    })();
  }, [response, request]);

  const signIn = useCallback(async () => {
    setError(null);
    if (!request) return;
    // useProxy isn't needed on standalone or web — Expo picks the right
    // redirect URI from the app's `scheme` automatically.
    await promptAsync();
  }, [promptAsync, request]);

  const signOut = useCallback(async () => {
    if (tokens?.refreshToken) {
      await revokeToken(tokens.refreshToken);
    } else if (tokens?.accessToken) {
      await revokeToken(tokens.accessToken);
    }
    await clearTokens();
    setTokens(null);
  }, [tokens]);

  return {
    ready,
    isSignedIn: !!tokens,
    user: tokens?.user,
    signIn,
    signOut,
    error,
  };
}

// Ensures the auth UI can finish on Android/iOS standalone builds. Calling
// it at module load (above) is generally enough but we also export it for
// platforms (like web) that may need it called from a route file.
export { WebBrowser };
export const PLATFORM = Platform.OS;
