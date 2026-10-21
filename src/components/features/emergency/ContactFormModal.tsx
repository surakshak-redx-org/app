import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect, useMemo, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import type { EmergencyContactFormValues } from '@/types/emergency.types';
import type { EmergencyContact } from '@/types/user.types';
import { formatIndianPhone, sanitizePhoneInput, validateIndianPhone } from '@/utils/phone.utils';

export interface ContactFormModalProps {
  visible: boolean;
  initial?: EmergencyContact | null;
  /** True while the parent is executing the async save — disables Save to prevent double-submit. */
  isSubmitting?: boolean;
  onSubmit: (values: EmergencyContactFormValues) => void;
  onClose: () => void;
}

const NAME_MAX = 50;
const RELATIONSHIP_MAX = 30;

const EMPTY: EmergencyContactFormValues = { name: '', phone: '', relationship: '' };

export function ContactFormModal({
  visible,
  initial,
  isSubmitting = false,
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

  const prevVisibleRef = useRef(false);
  const prevInitialRef = useRef<EmergencyContact | null | undefined>(undefined);

  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    const prevInitial = prevInitialRef.current;
    prevVisibleRef.current = visible;
    prevInitialRef.current = initial;

    if (!visible) return;
    // Only reset when modal transitions from closed to open, or when the initial contact changes (BUG-140).
    if (!wasVisible || initial !== prevInitial) {
      reset(
        initial
          ? { name: initial.name, phone: initial.phone, relationship: initial.relationship }
          : EMPTY,
      );
    }
  }, [visible, initial, reset]);

  function submit(values: EmergencyContactFormValues): void {
    // Normalise to E.164 (stripping raw leading zeroes, country code formatting) (BUG-144).
    onSubmit({
      name: values.name.trim(),
      phone: formatIndianPhone(values.phone),
      relationship: values.relationship.trim(),
    });
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
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
            onChangeText={(text) => field.onChange(sanitizePhoneInput(text))}
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
        disabled={!isValid || isSubmitting}
        loading={isSubmitting}
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
    </BottomSheet>
  );
}
