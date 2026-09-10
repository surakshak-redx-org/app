import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/constants/colors';
import { ROUTES } from '@/constants/routes';
import { ICON_SIZE } from '@/constants/ui';
import type { EmergencyContact } from '@/types/user.types';

export interface ContactMultiSelectProps {
  contacts: EmergencyContact[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

/**
 * A checkbox list of the user's custom emergency contacts. Predefined helplines
 * are the caller's job to filter out. Shows a "add contacts first" empty state
 * with a shortcut to the emergency-contacts screen.
 */
export function ContactMultiSelect({
  contacts,
  selectedIds,
  onToggle,
}: ContactMultiSelectProps): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon="people"
        title={t('location.addContactsFirst')}
        actionLabel={t('emergency.addContact')}
        onAction={() => router.push(ROUTES.EMERGENCY_CONTACTS)}
      />
    );
  }

  return (
    <Card padding="md">
      {contacts.map((contact) => {
        const selected = selectedIds.includes(contact.id);
        return (
          <Pressable
            key={contact.id}
            onPress={() => onToggle(contact.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            className="flex-row items-center gap-3 py-3"
          >
            <MaterialIcons
              name={selected ? 'check-box' : 'check-box-outline-blank'}
              size={ICON_SIZE.ROW}
              color={selected ? COLORS.SHAKTI_PURPLE : COLORS.STONE}
            />
            <View className="flex-1">
              <Text variant="body">{contact.name}</Text>
              <Text variant="caption">{contact.phone}</Text>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}
