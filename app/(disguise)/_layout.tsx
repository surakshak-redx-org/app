import { Stack } from 'expo-router';
import React from 'react';

export default function DisguiseLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
