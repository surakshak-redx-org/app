import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { COLORS } from '@/constants/colors';

type IconName = keyof typeof Ionicons.glyphMap;

interface TabBarIconProps {
  color: ColorValue;
  size: number;
}

function tabIcon(name: IconName): (props: TabBarIconProps) => React.JSX.Element {
  return function TabBarIcon({ color, size }: TabBarIconProps): React.JSX.Element {
    return <Ionicons name={name} size={size} color={color} />;
  };
}

export default function TabsLayout(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.SHAKTI_PURPLE,
        tabBarInactiveTintColor: COLORS.STONE,
        tabBarStyle: {
          backgroundColor: COLORS.WHITE,
          borderTopColor: COLORS.OFF_WHITE,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('nav.home'), tabBarIcon: tabIcon('shield-checkmark') }}
      />
      <Tabs.Screen name="map" options={{ title: t('nav.map'), tabBarIcon: tabIcon('map') }} />
      <Tabs.Screen
        name="community"
        options={{ title: t('nav.community'), tabBarIcon: tabIcon('people') }}
      />
      <Tabs.Screen
        name="info"
        options={{ title: t('nav.info'), tabBarIcon: tabIcon('information-circle') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('nav.profile'), tabBarIcon: tabIcon('person') }}
      />
    </Tabs>
  );
}
