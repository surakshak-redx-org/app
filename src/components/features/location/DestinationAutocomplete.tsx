import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { captureException } from '@/config/sentry';
import { APP_CONFIG } from '@/constants/config';
import { autocompletePlaces, getPlaceLocation } from '@/services/location.service';
import type { PlaceLocation, PlaceSuggestion } from '@/types/location.types';

export interface DestinationAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Fired when the user picks a suggestion — carries the resolved coordinates. */
  onSelectPlace: (place: PlaceLocation) => void;
  bias?: { latitude: number; longitude: number } | undefined;
  error?: string | undefined;
}

export function DestinationAutocomplete({
  value,
  onChangeText,
  onSelectPlace,
  bias,
  error,
}: DestinationAutocompleteProps): React.JSX.Element {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const justPickedRef = useRef(false);

  const query = value.trim();
  const tooShort = query.length < APP_CONFIG.PLACE_AUTOCOMPLETE_MIN_CHARS;

  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false;
      return;
    }
    if (tooShort) return;

    let cancelled = false;
    const handle = setTimeout(() => {
      autocompletePlaces(query, bias)
        .then((next) => {
          if (!cancelled) {
            setSuggestions(next);
            setDismissed(false);
          }
        })
        .catch((autocompleteError: unknown) => captureException(autocompleteError));
    }, APP_CONFIG.PLACE_AUTOCOMPLETE_DEBOUNCE_MS);

    return (): void => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, tooShort, bias]);

  const pick = useCallback(
    (suggestion: PlaceSuggestion): void => {
      justPickedRef.current = true;
      setDismissed(true);
      setSuggestions([]);
      onChangeText(suggestion.primaryText);
      getPlaceLocation(suggestion.placeId)
        .then((place) => onSelectPlace(place))
        .catch((detailsError: unknown) => captureException(detailsError));
    },
    [onChangeText, onSelectPlace],
  );

  const isOpen = !dismissed && !tooShort && suggestions.length > 0;

  const handleChangeText = useCallback(
    (text: string): void => {
      setDismissed(false);
      onChangeText(text);
    },
    [onChangeText],
  );

  return (
    <View>
      <Input
        label={t('location.destination')}
        placeholder={t('location.destinationPlaceholder')}
        value={value}
        onChangeText={handleChangeText}
        error={error}
      />

      {isOpen && (
        <Card padding="sm" className="-mt-2 mb-4">
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.placeId}
              onPress={() => pick(suggestion)}
              accessibilityRole="button"
              className="py-2"
            >
              <Text variant="body">{suggestion.primaryText}</Text>
              {suggestion.secondaryText.length > 0 && (
                <Text variant="caption" numberOfLines={1}>
                  {suggestion.secondaryText}
                </Text>
              )}
            </Pressable>
          ))}
        </Card>
      )}
    </View>
  );
}
