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
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  clearTokens,
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

const SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/drive.appdata',
];

// Stable extra params object. CRITICAL: if this is recreated each render,
// Google.useAuthRequest regenerates the underlying AuthRequest and with it
// the PKCE code_verifier, so by exchange time `request.codeVerifier` no
// longer matches the code_challenge Google saw → invalid_grant.
const EXTRA_PARAMS = { access_type: 'offline', prompt: 'consent' } as const;

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
    // EXTRA_PARAMS is module-level so its identity is stable; see comment
    // on the constant.
    extraParams: EXTRA_PARAMS as any,
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

  // When the OAuth round-trip returns, the Google provider has already
  // exchanged the auth code internally (its shouldAutoExchangeCode defaults
  // to true), so the tokens are sitting on response.authentication. We must
  // NOT re-exchange the code ourselves — it's single-use, and a second
  // attempt yields invalid_grant.
  useEffect(() => {
    (async () => {
      if (!response) return;
      console.log('[auth] response.type=', response.type);
      if (response.type !== 'success') {
        if (response.type === 'error') setError(response.error?.message ?? 'Sign-in failed');
        return;
      }
      const auth = (response as any).authentication as
        | { accessToken: string; refreshToken?: string | null; expiresIn?: number; scope?: string }
        | null;
      if (!auth?.accessToken) {
        console.warn('[auth] success but no authentication yet — waiting for next render');
        return;
      }

      try {
        let user: GoogleUser | undefined;
        try {
          user = await fetchUserInfo(auth.accessToken);
        } catch (e) {
          console.warn('[auth] userinfo failed', e);
        }

        const next: Tokens = {
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken ?? null,
          expiresAt: Date.now() + (auth.expiresIn ?? 3600) * 1000,
          scope: auth.scope ?? SCOPES.join(' '),
          user,
        };
        await saveTokens(next);
        setTokens(next);
        setError(null);
        console.log('[auth] signed in as', user?.email ?? '(no userinfo)');
      } catch (e: any) {
        console.warn('[auth] post-exchange failed', e);
        setError(e?.message ?? String(e));
      }
    })();
  }, [response]);

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
