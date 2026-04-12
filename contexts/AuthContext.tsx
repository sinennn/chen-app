import { configureGoogleSignIn } from '@/lib/auth';
import AsyncStorage from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  user_tag?: string;
  avatar_id: string;
  is_premium: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const profileFetchRef = useRef<Promise<UserProfile | null> | null>(null);

  const PROFILE_CACHE_KEY = 'chen_user_profile';

  const isNonEmpty = (value?: string | null) => typeof value === 'string' && value.trim().length > 0;

  const mergeProfileWithCached = (
    incoming: UserProfile | null,
    cached: UserProfile | null
  ): UserProfile | null => {
    if (!incoming && !cached) {
      return null;
    }

    if (!incoming) {
      return cached;
    }

    if (!cached) {
      return incoming;
    }

    return {
      ...cached,
      ...incoming,
      username: isNonEmpty(incoming.username) ? incoming.username : cached.username,
      user_tag: isNonEmpty(incoming.user_tag) ? incoming.user_tag : cached.user_tag,
      avatar_id: isNonEmpty(incoming.avatar_id) ? incoming.avatar_id : cached.avatar_id,
      email: isNonEmpty(incoming.email) ? incoming.email : cached.email,
      created_at: isNonEmpty(incoming.created_at) ? incoming.created_at : cached.created_at,
    };
  };

  const loadCachedProfile = async (): Promise<UserProfile | null> => {
    try {
      const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as UserProfile;
    } catch (error) {
      console.error('AuthContext: Failed loading cached profile', error);
      return null;
    }
  };

  const saveCachedProfile = async (profileData: UserProfile | null) => {
    try {
      if (!profileData) {
        await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
        return;
      }

      const existingCached = await loadCachedProfile();
      const mergedProfile = mergeProfileWithCached(profileData, existingCached);
      if (!mergedProfile) {
        await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
        return;
      }

      await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(mergedProfile));
    } catch (error) {
      console.error('AuthContext: Failed saving cached profile', error);
    }
  };

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    const cachedProfile = await loadCachedProfile();

    if (profileFetchRef.current) {
      const pendingResult = await profileFetchRef.current;
      return mergeProfileWithCached(pendingResult, cachedProfile);
    }

    const request = (async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, email, username, user_tag, avatar_id, is_premium, created_at')
          .eq('id', userId)
          .single();

        if (error) {
          // If user doesn't exist in users table, create them
          if (error.code === 'PGRST116') {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user) {
              const newUser = {
                id: user.id,
                email: user.email || '',
                username: '',
                avatar_id: '',
                is_premium: false,
                created_at: new Date().toISOString(),
              };
              const { data: createdUser, error: createError } = await supabase
                .from('users')
                .insert(newUser)
                .select()
                .single();

              if (createError) {
                console.error('AuthContext: Error creating user profile:', createError);
                return cachedProfile;
              }

              const profileResult = mergeProfileWithCached(createdUser as UserProfile, cachedProfile);
              await saveCachedProfile(profileResult);
              return profileResult;
            }
          }
          console.error('AuthContext: Error fetching user profile:', error);
          return cachedProfile;
        }

        const profileResult = mergeProfileWithCached(data as UserProfile, cachedProfile);
        await saveCachedProfile(profileResult);
        return profileResult;
      } catch (error) {
        console.error('AuthContext: Exception fetching user profile:', error);
        return cachedProfile;
      } finally {
        profileFetchRef.current = null;
      }
    })();

    profileFetchRef.current = request;
    return request;
  };

  useEffect(() => {
    // Configure Google Sign-In
    configureGoogleSignIn();

    const init = async () => {
      const cachedProfile = await loadCachedProfile();
      if (cachedProfile) {
        setProfile(cachedProfile);
      }

      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const userProfile = await fetchUserProfile(session.user.id);
        if (userProfile) {
          setProfile(userProfile);
        }
      } else {
        if (!cachedProfile) {
          setProfile(null);
        }
      }

      setLoading(false);
    };

    init();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const userProfile = await fetchUserProfile(session.user.id);
        if (userProfile) {
          setProfile(userProfile);
        }
      } else {
        setProfile(null);
        await saveCachedProfile(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
    
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('AuthContext: Supabase sign out error:', error);
        throw error;
      }
      
      // Clear local state
      setProfile(null);
      setUser(null);
      setSession(null);
      profileFetchRef.current = null;
      await saveCachedProfile(null);

      // Navigate to login screen
      import('expo-router').then(({ router }) => {
        router.replace('/(auth)/signup');
      });
      
    } catch (error) {
      console.error('AuthContext: Sign out failed:', error);
      // Still clear local state even if Supabase sign out fails
      setProfile(null);
      setUser(null);
      setSession(null);
      profileFetchRef.current = null;
      
      import('expo-router').then(({ router }) => {
        router.replace('/(auth)/signup');
      });
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const userProfile = await fetchUserProfile(user.id);
      if (userProfile) {
        setProfile(userProfile);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
