import { configureGoogleSignIn } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';

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
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    if (profileLoading) return null; // Prevent concurrent fetches
    
    console.log('AuthContext: Fetching user profile for userId:', userId);
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, username, user_tag, avatar_id, is_premium, created_at')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('AuthContext: Profile fetch error:', error.code, error.message);
        // If user doesn't exist in users table, create them
        if (error.code === 'PGRST116') {
          console.log('AuthContext: User not found in database, creating new profile');
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const newUser = {
              id: user.id,
              email: user.email || '',
              username: user.email?.split('@')[0] || '',
              avatar_id: '', // Empty initially - will be set during onboarding
              is_premium: false,
              created_at: new Date().toISOString()
            };

            console.log('AuthContext: Creating new user profile:', newUser);
            const { data: createdUser, error: createError } = await supabase
              .from('users')
              .insert(newUser)
              .select()
              .single();

            if (createError) {
              console.error('AuthContext: Error creating user profile:', createError);
              return null;
            }

            console.log('AuthContext: Successfully created user profile:', createdUser);
            return createdUser as UserProfile;
          }
        }
        console.error('AuthContext: Error fetching user profile:', error);
        return null;
      }

      console.log('AuthContext: Successfully fetched user profile:', data);
      return data as UserProfile;
    } catch (error) {
      console.error('AuthContext: Exception fetching user profile:', error);
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    console.log('AuthContext: Initializing auth provider');
    // Configure Google Sign-In
    configureGoogleSignIn();

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('AuthContext: Got initial session:', session ? 'User authenticated' : 'No user');
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        console.log('AuthContext: User found, fetching profile');
        const userProfile = await fetchUserProfile(session.user.id);
        setProfile(userProfile);
      } else {
        console.log('AuthContext: No user session, setting profile to null');
        setProfile(null);
      }
      
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('AuthContext: Auth state changed:', _event, session ? 'User authenticated' : 'No user');
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        console.log('AuthContext: User authenticated, fetching profile');
        const userProfile = await fetchUserProfile(session.user.id);
        setProfile(userProfile);
      } else {
        console.log('AuthContext: User signed out, setting profile to null');
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      const userProfile = await fetchUserProfile(user.id);
      setProfile(userProfile);
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