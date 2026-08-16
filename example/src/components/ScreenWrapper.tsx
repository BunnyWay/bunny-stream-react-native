import * as React from 'react';
import { StatusBar, type StatusBarStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

type ScreenWrapperProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  barStyle?: StatusBarStyle;
  edges?: Edge[];
};

export function ScreenWrapper({
  children,
  style,
  barStyle = 'dark-content',
  edges = ['top'],
}: ScreenWrapperProps) {
  return (
    <SafeAreaView style={style} edges={edges}>
      <StatusBar barStyle={barStyle} />
      {children}
    </SafeAreaView>
  );
}
