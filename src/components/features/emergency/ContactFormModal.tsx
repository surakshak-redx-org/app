import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Modal, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import type { EmergencyContactFormValues } from '@/types/emergency.types';
import type { EmergencyContact } from '@/types/user.types';
import { validateIndianPhone } from '@/utils/phone.utils';

export interface ContactFormModalProps {
  visible: boolean;
  initial?: EmergencyContact | null;
  onSubmit: (values: EmergencyContactFormValues) => void;
  onClose: () => void;
}

const NAME_MAX = 50;
const RELATIONSHIP_MAX = 30;

const EMPTY: EmergencyContactFormValues = { name: '', phone: '', relationship: '' };

export function ContactFormModal({
  visible,
  initial,
  onSubmit,
  onClose,
}: ContactFormModalProps): React.JSX.Element {
  const { t } = useTranslation();

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t('emergency.nameRequired')).max(NAME_MAX),
        phone: z
          .string()
          .trim()
          .refine((value) => validateIndianPhone(value), t('emergency.invalidPhone')),
        relationship: z
          .string()
          .trim()
          .min(1, t('emergency.relationshipRequired'))
          .max(RELATIONSHIP_MAX),
      }),
    [t],
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<EmergencyContactFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!visible) return;
    reset(
      initial
        ? { name: initial.name, phone: initial.phone, relationship: initial.relationship }
        : EMPTY,
    );
  }, [visible, initial, reset]);

  function submit(values: EmergencyContactFormValues): void {
    onSubmit({
      name: values.name.trim(),
      phone: values.phone.trim(),
      relationship: values.relationship.trim(),
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-near-black/40">
        <View className="rounded-t-3xl bg-off-white px-4 pb-8 pt-6">
          <Text
            variant="h2"
            tKey={initial ? 'emergency.editContact' : 'emergency.addContact'}
            className="mb-4"
          />

          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <Input
                label={t('emergency.nameLabel')}
                placeholder={t('emergency.namePlaceholder')}
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={errors.name?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <Input
                label={t('emergency.phoneLabel')}
                placeholder={t('emergency.phonePlaceholder')}
                keyboardType="phone-pad"
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={errors.phone?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="relationship"
            render={({ field }) => (
              <Input
                label={t('emergency.relationshipLabel')}
                placeholder={t('emergency.relationshipPlaceholder')}
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={errors.relationship?.message}
              />
            )}
          />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="mt-2"
            label={t('common.save')}
            disabled={!isValid}
            onPress={() => {
              void handleSubmit(submit)();
            }}
          />
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
