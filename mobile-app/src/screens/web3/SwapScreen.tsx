import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiClient } from '../../lib/api/client';
import { env } from '../../config/env';
import { tokens } from '../../theme/tokens';

interface GoldbackRateResponse {
  success: boolean;
  rate: number;
  minutesSinceUpdate: number | null;
}

export function SwapScreen() {
  const [goldbackRateUsd, setGoldbackRateUsd] = useState<number | null>(null);
  const [minutesSinceUpdate, setMinutesSinceUpdate] = useState<number | null>(null);
  const [status, setStatus] = useState('Swap is gated while the mobile trading flow is finalized.');
  const [busy, setBusy] = useState(false);

  const loadRate = useCallback(async () => {
    setBusy(true);
    try {
      const goldback = await apiClient.get<GoldbackRateResponse>('/api/goldback-rate');
      if (!goldback.success) {
        throw new Error('Unable to load current WGB price');
      }

      setGoldbackRateUsd(goldback.rate);
      setMinutesSinceUpdate(goldback.minutesSinceUpdate);
      setStatus('Swap remains hidden. Price reference is current.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load WGB price');
    } finally {
      setBusy(false);
    }
  }, []);

  const priceLabel = useMemo(() => (goldbackRateUsd === null ? '--' : `$${goldbackRateUsd.toFixed(2)}`), [goldbackRateUsd]);
  const updatedLabel = useMemo(() => {
    if (minutesSinceUpdate === null) return 'Update time unavailable';
    if (minutesSinceUpdate <= 0) return 'Updated moments ago';
    return `Updated ${minutesSinceUpdate} min ago`;
  }, [minutesSinceUpdate]);

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.topRow}>
        <Pressable style={styles.ghostButton} onPress={() => void loadRate()} disabled={busy}>
          <Text style={styles.ghostButtonText}>{busy ? 'Refreshing...' : 'Refresh WGB Price'}</Text>
        </Pressable>
      </View>

      <View style={styles.mainWrapper}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Swap</Text>
          <Text style={styles.stepIndicator}>Disabled</Text>
        </View>

        <Text style={styles.description}>
          Mobile swap remains gated. The route stays in place for future activation, but no on-chain trading is available here yet.
        </Text>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>WGB price</Text>
          <Text style={styles.priceValue}>{priceLabel}</Text>
          <Text style={styles.priceMeta}>{updatedLabel}</Text>
          <Text style={styles.priceMeta}>Network: {env.solanaNetwork}</Text>
        </View>

        <View style={styles.messageBox}>
          <Text style={styles.messageText}>
            Coming Soon. Use the Dashboard for market visibility and Gold Collection checkout for active mobile purchases.
          </Text>
        </View>
      </View>

      <Text style={styles.status}>{status}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.lg,
    paddingTop: 40,
    backgroundColor: '#0a0a0a',
    minHeight: '100%',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  mainWrapper: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  stepIndicator: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  description: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  priceCard: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    marginBottom: 24,
  },
  priceLabel: {
    color: '#6b7280',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceValue: {
    color: '#c9a84c',
    fontSize: 40,
    fontWeight: '700',
    marginTop: 8,
  },
  priceMeta: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 6,
  },
  messageBox: {
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.18)',
    padding: 16,
  },
  messageText: {
    color: '#e5e7eb',
    fontSize: 13,
    lineHeight: 20,
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ghostButtonText: {
    color: '#c9a84c',
    fontSize: 12,
    fontWeight: '700',
  },
  status: {
    marginTop: 20,
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 12,
  },
});
