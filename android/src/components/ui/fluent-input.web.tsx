import React from 'react';
import { View, type TextInputProps } from 'react-native';
import { Input } from './input';

interface Props extends TextInputProps {
  label?: string;
  hint?: string;
  trailing?: React.ReactNode;
}

export function FluentInput({ trailing, ...props }: Props) {
  return (
    <View style={{ position: 'relative' }}>
      <Input {...props} />
      {trailing ? <View style={{ position: 'absolute', right: 6, top: 34 }}>{trailing}</View> : null}
    </View>
  );
}
