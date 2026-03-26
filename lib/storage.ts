//@ts-nocheck
import { Platform } from 'react-native';

let AsyncStorage: any;

if (Platform.OS === 'web') {
    AsyncStorage = {
    getItem: async (key: string) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Ignore errors
      }
    },
    removeItem: async (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore errors
      }
    },
  };
} else {
  // For native platforms, use the regular AsyncStorage
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
}

export default AsyncStorage;