import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
//@ts-ignore
import { Platform } from 'react-native';

import { api } from './api';
import AsyncStorage from './storage';

const LAST_PUSH_TOKEN_KEY = 'chen_last_push_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function syncPushToken(options?: { force?: boolean }): Promise<void> {
  if (Platform.OS === 'web') return;

  const token = await registerForPushNotifications();
  if (!token) return;

  const lastToken = await AsyncStorage.getItem(LAST_PUSH_TOKEN_KEY);
  if (!options?.force && lastToken === token) return;

  await api.notifications.registerPushToken({
    token,
    platform: Platform.OS,
    device_id: Device.modelId ?? undefined,
  });

  await AsyncStorage.setItem(LAST_PUSH_TOKEN_KEY, token);
}

export async function unregisterPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;

  const token = await AsyncStorage.getItem(LAST_PUSH_TOKEN_KEY);
  if (!token) return;

  try {
    await api.notifications.unregisterPushToken({
      token,
      device_id: Device.modelId ?? undefined,
    });
  } finally {
    await AsyncStorage.removeItem(LAST_PUSH_TOKEN_KEY);
  }
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  return tokenResponse.data ?? null;
}
