import { Image, ImageProps, View } from 'react-native';

import { Colors } from '@/constants/theme';

type AvatarRingProps = {
  size?: number;
  isPlaying?: boolean;
} & Omit<ImageProps, 'style'>;

export function AvatarRing({ size = 44, isPlaying = false, source, ...rest }: AvatarRingProps) {
  const ringSize = size + 10;

  return (
    <View
      style={{
        width: ringSize,
        height: ringSize,
        borderRadius: ringSize / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: isPlaying ? Colors.orange : Colors.border,
      }}
    >
      <Image
        {...rest}
        source={source}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
      />
    </View>
  );
}

