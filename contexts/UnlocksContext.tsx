import { DEFAULT_THEME_KEY, ThemeKey } from '@/constants/theme';
import { ReferralPerkKey, ReferralStatus, api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type UnlocksContextValue = {
  status: ReferralStatus | null;
  loading: boolean;
  refreshStatus: () => Promise<void>;
  hasPerk: (perkKey: ReferralPerkKey) => boolean;
  isThemeUnlocked: (themeKey: ThemeKey) => boolean;
  isTopArtistUnlocked: (rank: number) => boolean;
};

const UnlocksContext = createContext<UnlocksContextValue>({
  status: null,
  loading: true,
  refreshStatus: async () => {},
  hasPerk: () => false,
  isThemeUnlocked: (themeKey) => themeKey === DEFAULT_THEME_KEY,
  isTopArtistUnlocked: (rank) => rank <= 2,
});

const EMPTY_STATUS: ReferralStatus = {
  referral_code: '',
  theme_preference: DEFAULT_THEME_KEY,
  onboarding_complete: false,
  voice_notes_unlocked: false,
  unlocked_theme_keys: [DEFAULT_THEME_KEY],
  unlocked_artist_ranks: [1, 2],
  perks: [],
};

export function UnlocksProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStatus = async () => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const nextStatus = await api.referrals.status();
      setStatus(nextStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const missingRoute =
        message.includes('404') ||
        message.toLowerCase().includes('page not found') ||
        message.toLowerCase().includes('not found');

      if (!missingRoute) {
        console.error('UnlocksContext: Failed to load referral status', error);
      }

      setStatus(EMPTY_STATUS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }

    refreshStatus();
  }, [authLoading, user?.id]);

  const value = useMemo<UnlocksContextValue>(() => {
    const perkMap = new Map((status?.perks || []).map((perk) => [perk.key, perk.unlocked]));
    const unlockedThemes = new Set(status?.unlocked_theme_keys || [DEFAULT_THEME_KEY]);
    const unlockedArtistRanks = new Set(status?.unlocked_artist_ranks || [1, 2]);

    return {
      status,
      loading,
      refreshStatus,
      hasPerk: (perkKey) => perkMap.get(perkKey) === true,
      isThemeUnlocked: (themeKey) => unlockedThemes.has(themeKey),
      isTopArtistUnlocked: (rank) => unlockedArtistRanks.has(rank) || rank <= 2,
    };
  }, [loading, status]);

  return <UnlocksContext.Provider value={value}>{children}</UnlocksContext.Provider>;
}

export function useUnlocks() {
  return useContext(UnlocksContext);
}
