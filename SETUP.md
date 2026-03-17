# Chen App Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   - Copy `.env.example` to `.env`
   - Update the placeholder values with your actual API keys when ready

3. **Start Development Server**
   ```bash
   npm start
   ```

4. **Run on Device/Simulator**
   ```bash
   npm run ios     # iOS simulator
   npm run android # Android emulator
   ```

## Current Status

The app is currently running with:
- ✅ Complete UI/UX implementation
- ✅ Navigation and routing
- ✅ Mock data for development
- ✅ Theme system
- ✅ Animation framework
- 🚧 Backend integration (placeholder implementations)

## Known Issues Fixed

- ❌ Google Sign-in native module error → ✅ Temporarily disabled with placeholder
- ❌ SafeAreaView deprecation warning → ✅ Already using correct import
- ❌ App.json configuration issues → ✅ Cleaned up invalid properties

## Next Steps

1. **Set up Supabase**
   - Create a Supabase project
   - Update `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`

2. **Configure Music Platform APIs**
   - Set up Spotify Developer account and get client ID
   - Configure Apple Music API keys
   - Set up Audiomack API access

3. **Google Sign-in Configuration**
   - Google Sign-in is now implemented using Expo's built-in auth session
   - No additional native packages required
   - Configure your Google OAuth credentials in the environment variables
   - The implementation is in `lib/auth.ts` using `expo-auth-session`

## Development Notes

- The app uses Expo Router for navigation
- All screens are implemented with mock data
- Backend server is in the `server/` directory (Golang + Gin)
- Design system is in `constants/theme.ts`
- Reusable components are in `components/ui/`

## Troubleshooting

If you encounter issues:
1. Clear Expo cache: `npx expo start --clear`
2. Reset Metro bundler: `npx expo start --reset-cache`
3. Reinstall dependencies: `rm -rf node_modules && npm install`