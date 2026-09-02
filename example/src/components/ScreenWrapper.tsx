import * as React from 'react';
import { StatusBar, StyleSheet, View, type StatusBarStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

type ScreenWrapperProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  barStyle?: StatusBarStyle;
  edges?: Edge[];
};

export function ScreenWrapper({
  children,
  style,
  barStyle = 'light-content',
  edges = ['top'],
}: ScreenWrapperProps) {
  return (
    <SafeAreaView style={wrapperStyles.safeArea} edges={edges}>
      <StatusBar barStyle={barStyle} />
      <View style={style}>{children}</View>
    </SafeAreaView>
  );
}

const wrapperStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },
});
