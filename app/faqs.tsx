import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, TextInput, View } from 'react-native';

import { CategoryFilter, OfflineBanner } from '@/components/features/info/InfoFilters';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/constants/colors';
import { ALL_CATEGORIES } from '@/constants/config';
import { useInfoContent } from '@/hooks/useInfoContent';
import { trackFaqViewed } from '@/services/analytics.service';
import { getFaqCategories, getFaqs, type Faq } from '@/services/firebase/laws.service';
import { CACHE_KEYS } from '@/utils/cache.utils';

function matchesQuery(faq: Faq, query: string): boolean {
  if (query === '') return true;
  const needle = query.toLowerCase();
  return faq.question.toLowerCase().includes(needle) || faq.answer.toLowerCase().includes(needle);
}

export default function FaqsScreen(): React.JSX.Element {
  const { t } = useTranslation();

  const { items, categories, isLoading, hasError, isOffline, lastSyncDate, reload } =
    useInfoContent<Faq>(getFaqs, getFaqCategories, CACHE_KEYS.FAQS);

  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const matched = items.filter(
      (faq) =>
        (selectedCategory === ALL_CATEGORIES || faq.category === selectedCategory) &&
        matchesQuery(faq, searchQuery),
    );
    if (selectedCategory !== ALL_CATEGORIES) return matched;
    return [...matched].sort((a, b) =>
      a.category === b.category ? a.order - b.order : a.category.localeCompare(b.category),
    );
  }, [items, selectedCategory, searchQuery]);

  const toggle = (faq: Faq): void => {
    setExpandedId((current) => (current === faq.id ? null : faq.id));
    if (expandedId !== faq.id) trackFaqViewed(faq.id, faq.category);
  };

  if (isLoading) {
    return (
      <ErrorBoundary>
        <SafeScreen>
          <ScreenHeader titleKey="info.faq" />
          <Spinner size="lg" className="flex-1 items-center justify-center" />
        </SafeScreen>
      </ErrorBoundary>
    );
  }

  if (hasError && items.length === 0) {
    return (
      <ErrorBoundary>
        <SafeScreen>
          <ScreenHeader titleKey="info.faq" />
          <EmptyState
            icon="alert-circle-outline"
            title={t('info.loadError')}
            actionLabel={t('common.retry')}
            onAction={reload}
          />
        </SafeScreen>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SafeScreen>
        <ScreenHeader titleKey="info.faq" />

        {isOffline && lastSyncDate !== null && <OfflineBanner syncedAt={lastSyncDate} />}

        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('info.search')}
          placeholderTextColor={COLORS.STONE}
          clearButtonMode="while-editing"
          className="mb-3 h-11 rounded-xl border border-stone/20 bg-white px-4 text-base text-ink"
        />

        <CategoryFilter
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerClassName="pb-8"
          renderItem={({ item }) => {
            const expanded = expandedId === item.id;
            return (
              <Pressable onPress={() => toggle(item)}>
                <Card padding="md" className="mb-2">
                  {selectedCategory === ALL_CATEGORIES && (
                    <Text variant="label" className="mb-1 text-shakti-purple">
                      {item.category}
                    </Text>
                  )}
                  <View className="flex-row items-center gap-2">
                    <Text variant="label" className="flex-1">
                      {item.question}
                    </Text>
                    <MaterialIcons
                      name={expanded ? 'expand-less' : 'expand-more'}
                      size={20}
                      color={COLORS.STONE}
                    />
                  </View>
                  {expanded && (
                    <View className="mt-3 border-t border-stone/10 pt-3">
                      <Text variant="body" className="text-stone">
                        {item.answer}
                      </Text>
                    </View>
                  )}
                </Card>
              </Pressable>
            );
          }}
          ListEmptyComponent={<EmptyState icon="search-outline" title={t('info.noFaqsFound')} />}
        />
      </SafeScreen>
    </ErrorBoundary>
  );
}
