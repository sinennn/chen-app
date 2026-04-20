import { ReferralPerkKey, api } from '@/lib/api';
import AsyncStorage from '@/lib/storage';

const PENDING_REFERRAL_STORAGE_KEY = 'chen_pending_referral';

export type PendingReferral = {
  referral_code: string;
  perk_key: ReferralPerkKey;
};

const VALID_PERKS = new Set<ReferralPerkKey>([
  'top_artist_3',
  'top_artist_4',
  'top_artist_5',
  'voice_notes',
  'theme_lagos_night',
  'theme_harmattan',
  'theme_midnight_afro',
  'theme_atilola_red',
]);

export function normalizePendingReferral(input: Partial<PendingReferral> | null | undefined): PendingReferral | null {
  if (!input) {
    return null;
  }

  const referralCode = typeof input.referral_code === 'string' ? input.referral_code.trim().toLowerCase() : '';
  const perkKey = typeof input.perk_key === 'string' ? input.perk_key.trim().toLowerCase() : '';

  if (!referralCode || !VALID_PERKS.has(perkKey as ReferralPerkKey)) {
    return null;
  }

  return {
    referral_code: referralCode,
    perk_key: perkKey as ReferralPerkKey,
  };
}

export async function storePendingReferral(input: Partial<PendingReferral> | null | undefined) {
  const normalized = normalizePendingReferral(input);
  if (!normalized) {
    return null;
  }

  await AsyncStorage.setItem(PENDING_REFERRAL_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function getPendingReferral() {
  const raw = await AsyncStorage.getItem(PENDING_REFERRAL_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizePendingReferral(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function clearPendingReferral() {
  await AsyncStorage.removeItem(PENDING_REFERRAL_STORAGE_KEY);
}

export async function completeReferralOnboarding() {
  const pendingReferral = await getPendingReferral();
  const response = await api.referrals.completeOnboarding(pendingReferral || {});
  if (pendingReferral) {
    await clearPendingReferral();
  }
  return response;
}
