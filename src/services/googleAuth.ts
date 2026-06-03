// Google OAuth token management.
//
// Storage is platform-specific: SecureStore (Keychain / EncryptedSharedPreferences)
// on native, localStorage on web. The hook in src/hooks/useGoogleAuth.ts drives
// the interactive sign-in; everything here is for after we have tokens.

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const TOKEN_KEY = 'minido.google.tokens.v1';

export interface GoogleUser {
  email?: string;
  name?: string;
  picture?: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string | null;
  // ms-epoch deadline at which the access token expires.
  expiresAt: number;
  scope: string;
  user?: GoogleUser;
}

interface GoogleAuthConfig {
  androidClientId?: string;
  iosClientId?: string;
  webClientId?: string;
}

export function getGoogleAuthConfig(): GoogleAuthConfig {
  return (Constants.expoConfig?.extra?.googleAuth as GoogleAuthConfig) ?? {};
}

// Picks the correct client_id for the current platform — matches how
// useGoogleAuth requests tokens, which matters because the same client_id
// must be used to refresh them later.
export function clientIdForCurrentPlatform(): string | undefined {
  const c = getGoogleAuthConfig();
  if (Platform.OS === 'android') return c.androidClientId;
  if (Platform.OS === 'ios') return c.iosClientId ?? c.webClientId;
  return c.webClientId;
}

// ── storage abstraction ──────────────────────────────────────────────────────

const storage = Platform.OS === 'web'
  ? {
      async get(key: string): Promise<string | null> {
        if (typeof localStorage === 'undefined') return null;
        return localStorage.getItem(key);
      },
      async set(key: string, value: string): Promise<void> {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      },
      async del(key: string): Promise<void> {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      },
    }
  : {
      async get(key: string): Promise<string | null> {
        return SecureStore.getItemAsync(key);
      },
      async set(key: string, value: string): Promise<void> {
        return SecureStore.setItemAsync(key, value);
      },
      async del(key: string): Promise<void> {
        return SecureStore.deleteItemAsync(key);
      },
    };

export async function saveTokens(t: Tokens): Promise<void> {
  await storage.set(TOKEN_KEY, JSON.stringify(t));
}

export async function loadTokens(): Promise<Tokens | null> {
  const raw = await storage.get(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tokens;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await storage.del(TOKEN_KEY);
}

// ── refresh + fetch user info ────────────────────────────────────────────────

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

// Treat token as expired 60 s before its real expiry to avoid using a
// just-about-to-expire token mid-request.
const EXPIRY_GRACE_MS = 60_000;

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }> {
  const clientId = clientIdForCurrentPlatform();
  if (!clientId) throw new Error('No Google client_id configured for this platform');

  const params: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  };
  // Web client requires the secret on refresh too. Android (installed) client
  // does not. process.env.EXPO_PUBLIC_* is statically inlined at build time
  // so this is safe to reference on both platforms.
  if (Platform.OS === 'web' && process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_SECRET) {
    params.client_secret = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_SECRET;
  }
  const body = new URLSearchParams(params);

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

// Returns a non-expired access token, refreshing if necessary. Returns null
// if the user is not signed in or the refresh failed (caller should treat
// this as "not signed in" and prompt re-auth).
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expiresAt - EXPIRY_GRACE_MS) return tokens.accessToken;
  if (!tokens.refreshToken) return null;

  try {
    const r = await refreshAccessToken(tokens.refreshToken);
    const next: Tokens = { ...tokens, accessToken: r.accessToken, expiresAt: r.expiresAt };
    await saveTokens(next);
    return next.accessToken;
  } catch (e) {
    console.warn('[googleAuth] refresh failed', e);
    return null;
  }
}

export async function fetchUserInfo(accessToken: string): Promise<GoogleUser> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  const j = (await res.json()) as { email?: string; name?: string; picture?: string };
  return { email: j.email, name: j.name, picture: j.picture };
}

// Best-effort token revocation on sign-out. Network errors are swallowed —
// local state always gets cleared so the user really is signed out locally
// even if Google can't be reached.
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, { method: 'POST' });
  } catch {
    /* ignore */
  }
}
