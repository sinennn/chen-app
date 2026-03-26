import { PropsWithChildren } from 'react';
import { Pressable, PressableProps, Text } from 'react-native';

import { Colors } from '@/constants/theme';

type OrangeButtonProps = PressableProps & {
  label?: string;
};

export function OrangeButton({
  label,
  children,
  style,
  ...rest
}: PropsWithChildren<OrangeButtonProps>) {
  return (
    <Pressable
      {...rest}
      className="w-full items-center justify-center rounded-full py-4"
      style={[
        {
          backgroundColor: Colors.orange,
          shadowColor: Colors.orange,
          shadowOpacity: 0.4,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
        },
        style,
      ]}
    >
      {label ? (
        <Text className="text-base font-semibold" style={{ color: Colors.white }}>
          {label}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

