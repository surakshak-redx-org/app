import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { COLORS } from '@/constants/colors';
import { PREDEFINED_EMERGENCY_NUMBERS } from '@/constants/emergency-numbers';
import { ICON_SIZE } from '@/constants/ui';

export interface EmergencyHelplineGridProps {
  onCall: (phone: string) => void;
}

export function EmergencyHelplineGrid({ onCall }: EmergencyHelplineGridProps): React.JSX.Element {
  const { t } = useTranslation();

  const primary112 = PREDEFINED_EMERGENCY_NUMBERS[0];
  const primaryPolice = PREDEFINED_EMERGENCY_NUMBERS[1];
  const primaryAmbulance = PREDEFINED_EMERGENCY_NUMBERS[2];
  const primaryWomen = PREDEFINED_EMERGENCY_NUMBERS[3];
  const otherHelplines = PREDEFINED_EMERGENCY_NUMBERS.slice(4);

  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between">
        <Text variant="h3" tKey="home.quickDial" />
        <Text variant="caption" className="text-stone dark:text-dark-text-secondary">
          India
        </Text>
      </View>

      {/* Prominent 112 Universal Helpline Button */}
      {primary112 !== undefined && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.callHelplineLabel', {
            name: primary112.name,
            phone: primary112.phone,
          })}
          onPress={() => onCall(primary112.phone)}
          className="mt-3 flex-row items-center justify-between rounded-2xl border border-primary-red/30 bg-primary-red/10 p-3.5"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-red">
              <Ionicons name="call" size={ICON_SIZE.ROW} color={COLORS.WHITE} />
            </View>
            <View>
              <Text variant="label" className="text-primary-red dark:text-primary-red">
                {primary112.name} · {primary112.phone}
              </Text>
              <Text variant="caption" className="text-stone dark:text-dark-text-secondary">
                Police • Fire • Ambulance (Universal)
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={ICON_SIZE.BADGE} color={COLORS.PRIMARY_RED} />
        </Pressable>
      )}

      {/* 3 Secondary Quick Lifelines */}
      <View className="mt-2.5 flex-row gap-2">
        {[primaryPolice, primaryWomen, primaryAmbulance].map((contact) => {
          if (contact === undefined) return null;
          return (
            <Pressable
              key={contact.id}
              accessibilityRole="button"
              accessibilityLabel={t('home.callHelplineLabel', {
                name: contact.name,
                phone: contact.phone,
              })}
              onPress={() => onCall(contact.phone)}
              className="flex-1 items-center rounded-xl border border-stone/20 bg-white p-2.5 shadow-sm dark:border-dark-border dark:bg-charcoal"
            >
              <Ionicons name="call-outline" size={ICON_SIZE.BADGE} color={COLORS.SHAKTI_PURPLE} />
              <Text variant="caption" className="mt-1 font-semibold text-ink dark:text-white">
                {contact.phone}
              </Text>
              <Text
                variant="caption"
                className="text-xs text-stone dark:text-dark-text-secondary"
                numberOfLines={1}
              >
                {contact.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Additional Specialized Helplines in Clean Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-2.5"
        contentContainerClassName="pr-4"
      >
        {otherHelplines.map((contact) => (
          <Pressable
            key={contact.id}
            onPress={() => onCall(contact.phone)}
            accessibilityRole="button"
            accessibilityLabel={t('home.callHelplineLabel', {
              name: contact.name,
              phone: contact.phone,
            })}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            className="mr-2 min-h-[36px] flex-row items-center rounded-full border border-stone/20 bg-white px-3 py-1.5 dark:border-dark-border dark:bg-charcoal"
          >
            <Text variant="caption" className="text-xs text-ink dark:text-white">
              {contact.name} · {contact.phone}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
