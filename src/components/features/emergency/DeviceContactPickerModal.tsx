// SDK 57 deprecated `getContactsAsync` on the main entry — the read API now
// lives behind the `/legacy` subpath. Permission prompting still uses the
// non-deprecated main module via `permissions.utils`.
import { Fields, getContactsAsync } from 'expo-contacts/legacy';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Linking, Modal, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import type { EmergencyContactFormValues } from '@/types/emergency.types';
import { requestContactsPermission } from '@/utils/permissions.utils';
import { formatIndianPhone } from '@/utils/phone.utils';

export interface DeviceContactPickerModalProps {
  visible: boolean;
  /** Normalized E.164 phone numbers that already exist in the user's emergency contacts. */
  existingPhones: ReadonlySet<string>;
  onPick: (values: EmergencyContactFormValues) => void;
  onClose: () => void;
}

interface DeviceContactRow {
  key: string;
  name: string;
  phone: string;
}

export function DeviceContactPickerModal({
  visible,
  existingPhones,
  onPick,
  onClose,
}: DeviceContactPickerModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DeviceContactRow[]>([]);

  useEffect(() => {
    if (!visible) return;

    let active = true;

    async function load(): Promise<void> {
      setLoading(true);
      setRows([]);
      try {
        const granted = await requestContactsPermission();
        if (!granted) {
          Alert.alert(t('errors.contactsPermissionDenied'), undefined, [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.ok'),
              onPress: (): void => {
                void Linking.openSettings();
              },
            },
          ]);
          onClose();
          return;
        }

        const { data } = await getContactsAsync({ fields: [Fields.PhoneNumbers] });

        const mapped: DeviceContactRow[] = data
          .map((contact, index) => {
            const phone = contact.phoneNumbers?.[0]?.number ?? '';
            return {
              key: contact.id ?? String(index),
              name: contact.name ?? '',
              phone,
            };
          })
          .filter((row) => row.phone.length > 0 && row.name.length > 0);

        if (active) setRows(mapped);
      } catch (error) {
        console.error('DeviceContactPickerModal load failed:', error);
        Alert.alert(t('errors.deviceContactsFailed'));
        onClose();
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return (): void => {
      active = false;
    };
  }, [visible, t, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-near-black/40">
        <View className="h-3/4 rounded-t-3xl bg-off-white px-4 pb-8 pt-6">
          <Text variant="h2" tKey="emergency.importFromContacts" className="mb-1" />
          <Text variant="caption" tKey="emergency.importSelectPrompt" className="mb-4" />

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <Spinner size="lg" />
            </View>
          ) : rows.length === 0 ? (
            <EmptyState icon="person-outline" title={t('emergency.noContactsYet')} />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(row) => row.key}
              renderItem={({ item }) => {
                const normalizedPhone = formatIndianPhone(item.phone);
                const isAlreadyAdded = existingPhones.has(normalizedPhone);
                return (
                  <Pressable
                    onPress={() => {
                      if (!isAlreadyAdded) {
                        onPick({ name: item.name, phone: item.phone, relationship: '' });
                      }
                    }}
                    disabled={isAlreadyAdded}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isAlreadyAdded }}
                    className={`border-b border-stone/15 py-3 ${
                      isAlreadyAdded ? 'opacity-40' : ''
                    }`}
                  >
                    <Text variant="body">{item.name}</Text>
                    <Text variant="caption">
                      {isAlreadyAdded ? t('emergency.alreadyAdded') : item.phone}
                    </Text>
                  </Pressable>
                );
              }}
            />
          )}

          <Button
            variant="ghost"
            size="md"
            fullWidth
            className="mt-2"
            label={t('common.cancel')}
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}
