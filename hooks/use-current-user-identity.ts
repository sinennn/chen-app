import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_AVATAR_ID = 'default';
const DEFAULT_USERNAME = '--';
const GREETING_FALLBACK_NAME = 'there';

function normalizeIdentityValue(value?: string | null) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

export function buildCurrentUserAvatarUri(avatarId: string, size = 120) {
  return `https://api.dicebear.com/7.x/adventurer/png?seed=${avatarId}&size=${size}&backgroundColor=0D0B09`;
}

export function useCurrentUserIdentity() {
  const { profile } = useAuth();

  const username = normalizeIdentityValue(profile?.username) || DEFAULT_USERNAME;
  const userTag = normalizeIdentityValue(profile?.user_tag);
  const avatarId = normalizeIdentityValue(profile?.avatar_id) || DEFAULT_AVATAR_ID;

  return {
    username,
    userTag,
    avatarId,
    avatarUri: buildCurrentUserAvatarUri(avatarId),
    greetingName: username === DEFAULT_USERNAME ? GREETING_FALLBACK_NAME : username,
    hasUsername: username !== DEFAULT_USERNAME,
    hasUserTag: userTag.length > 0,
    getAvatarUri: (size = 120) => buildCurrentUserAvatarUri(avatarId, size),
  };
}
