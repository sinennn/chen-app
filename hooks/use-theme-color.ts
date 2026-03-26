import { Colors } from '@/constants/theme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName?: string
) {
  if (props.dark) {
    return props.dark;
  }
  if (props.light) {
    return props.light;
  }
  return Colors.bg;
}