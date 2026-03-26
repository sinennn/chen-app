import { PropsWithChildren } from 'react';
import { View, ViewProps } from 'react-native';

import { Colors } from '@/constants/theme';

type GlassCardProps = ViewProps & {
  padded?: boolean;
};

export function GlassCard({ children, padded = true, style, ...rest }: PropsWithChildren<GlassCardProps>) {
  return (
    <View
      {...rest}
      className={padded ? 'rounded-3xl p-4' : 'rounded-3xl'}
      style={[
        {
          backgroundColor: Colors.bgGlass,
          borderColor: Colors.border,
          borderWidth: 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

