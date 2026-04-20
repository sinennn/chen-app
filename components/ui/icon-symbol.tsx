// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
export type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  'arrow.clockwise': 'refresh',
  'bell': 'notifications-none',
  'gearshape': 'settings',
  'magnifyingglass': 'search',
  'person.badge.plus': 'person-add',
  'checkmark.circle.fill': 'check-circle',
  'music.note': 'music-note',
  'play.fill': 'play-arrow',
  'pause.fill': 'pause',
  'mic.fill': 'mic',
  'stop.fill': 'stop',
  'message.fill': 'chat',
  'lock.fill': 'lock',
  // Additional symbols for Chen app tabs
  'flame.fill': 'whatshot',
  'person.2.fill': 'group',
  'person.circle.fill': 'person',
  // Ring-style icon for Chen tab
  'circle': 'circle',
  'record.circle': 'radio-button-unchecked',
  'arrow.up': 'arrow-upward',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
