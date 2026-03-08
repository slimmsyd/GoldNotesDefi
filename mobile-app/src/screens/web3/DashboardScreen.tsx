import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../lib/api/client';
import { getPortfolioSummary } from '../../lib/portfolio/summary-client';
import type { Web3StackParamList } from '../../navigation';
import { getProtocolStatus } from '../../lib/protocol/status-client';
import { ProtocolStatusData } from '../../lib/api/types';
import { tokens } from '../../theme/tokens';

type Props = NativeStackScreenProps<Web3StackParamList, 'Dashboard'>;

interface GoldbackRateResponse {
  success: boolean;
  rate: number;
  updatedAt?: string | null;
  minutesSinceUpdate: number | null;
}

function shortRoot(root: string): string {
  if (!root) return '—';
  if (root.length < 20) return root;
  return `${root.slice(0, 10)}...${root.slice(-8)}`;
}

export function DashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState('Syncing protocol status...');
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState<ProtocolStatusData | null>(null);
  const [goldbackRate, setGoldbackRate] = useState<number | null>(null);
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<string | null>(null);
  const [priceStatus, setPriceStatus] = useState('Loading WGB price...');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [protocolResponse, rateResponse, portfolioResponse] = await Promise.all([
        getProtocolStatus(),
        apiClient.get<GoldbackRateResponse>('/api/goldback-rate').catch(() => null),
        getPortfolioSummary().catch(() => null),
      ]);

      if (!protocolResponse.success || !protocolResponse.data) {
        setStatus(protocolResponse.error || 'Protocol status unavailable');
        setPayload(null);
      } else {
        setPayload(protocolResponse.data);
        setStatus('Protocol status synced');
      }

      if (rateResponse?.success) {
        setGoldbackRate(rateResponse.rate);
        const derivedUpdatedAt =
          rateResponse.updatedAt ??
          (typeof rateResponse.minutesSinceUpdate === 'number'
            ? new Date(Date.now() - rateResponse.minutesSinceUpdate * 60_000).toISOString()
            : new Date().toISOString());
        setPriceUpdatedAt(derivedUpdatedAt);
        setPriceStatus('Live WGB market reference');
      } else if (portfolioResponse && Number.isFinite(portfolioResponse.goldbackRateUsd)) {
        setGoldbackRate(portfolioResponse.goldbackRateUsd);
        setPriceUpdatedAt(portfolioResponse.lastUpdated || null);
        setPriceStatus('Fallback WGB market reference');
      } else {
        setGoldbackRate(null);
        setPriceUpdatedAt(null);
        setPriceStatus('Price feed unavailable');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to sync protocol status');
      setGoldbackRate(null);
      setPriceUpdatedAt(null);
      setPriceStatus('Price feed unavailable');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const ratioLabel = useMemo(() => {
    if (!payload?.solvency) return '—';
    if (payload.solvency.ratio === null) return '∞';
    return payload.solvency.ratio.toFixed(2);
  }, [payload?.solvency]);

  const updatedLabel = useMemo(() => {
    if (!payload?.fetchedAt) return '—';
    return new Date(payload.fetchedAt).toLocaleString();
  }, [payload?.fetchedAt]);

  const priceLabel = useMemo(() => (goldbackRate === null ? '--' : `$${goldbackRate.toFixed(2)}`), [goldbackRate]);
  const priceUpdatedLabel = useMemo(() => {
    if (!priceUpdatedAt) return 'Data unavailable';
    return new Date(priceUpdatedAt).toLocaleString();
  }, [priceUpdatedAt]);
  const overlayBottomInset = useMemo(() => Math.max(insets.bottom + 128, 136), [insets.bottom]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Solvency</Text>
            <Text style={styles.cardValue}>{payload?.solvency.status ?? 'UNKNOWN'}</Text>
            <Text style={styles.cardMeta}>Ratio: {ratioLabel}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Supply</Text>
            <Text style={styles.cardValue}>{payload?.onChain.totalSupply ?? 0}</Text>
            <Text style={styles.cardMeta}>WGB issued</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Reserves</Text>
            <Text style={styles.cardValue}>{payload?.onChain.provenReserves ?? 0}</Text>
            <Text style={styles.cardMeta}>Goldbacks proven</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Batches</Text>
            <Text style={styles.cardValue}>{payload?.offChain.totalBatches ?? 0}</Text>
            <Text style={styles.cardMeta}>Audit batches</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Current Merkle Root</Text>
          <Text style={styles.rootValue}>{shortRoot(payload?.onChain.currentMerkleRoot || '')}</Text>
          <Text style={styles.cardMeta}>Updated: {updatedLabel}</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={() => navigation.navigate('Redeem')}>
            <Text style={styles.actionText}>Open Redeem</Text>
          </Pressable>
          <Pressable style={styles.actionButtonSecondary} onPress={() => navigation.navigate('Vault')}>
            <Text style={styles.actionTextSecondary}>Vault Proof Trail</Text>
          </Pressable>
        </View>

        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.primaryButtonText}>Wallet Profile</Text>
        </Pressable>

        <Text style={styles.status}>{status}</Text>
      </ScrollView>

      <View style={[styles.comingSoonOverlay, { paddingBottom: overlayBottomInset }]}>
        <View style={styles.comingSoonScrim} />
        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonTitle}>Coming Soon</Text>
          <Text style={styles.comingSoonBody}>Mobile WGB trading is not live yet.</Text>

          <View style={styles.comingSoonPriceCard}>
            <Text style={styles.comingSoonPriceLabel}>WGB Price</Text>
            <Text style={styles.comingSoonPriceValue}>{priceLabel}</Text>
            <Text style={styles.comingSoonPriceMeta}>Updated {priceUpdatedLabel}</Text>
          </View>

          <Text style={styles.comingSoonNote}>
            Use Gold Collection for physical GoldBack purchases while wallet-native trading is finalized.
          </Text>
          <Text style={styles.comingSoonFootnote}>{priceStatus}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.colors.bgBase,
  },
  container: {
    padding: tokens.spacing.lg,
    paddingTop: 12,
    gap: tokens.spacing.md,
    backgroundColor: tokens.colors.bgBase,
  },
  grid: {
    gap: tokens.spacing.sm,
  },
  card: {
    backgroundColor: tokens.colors.bgElevated,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    padding: tokens.spacing.md,
    gap: 4,
  },
  cardLabel: {
    color: tokens.colors.textTertiary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  cardValue: {
    color: tokens.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  cardMeta: {
    color: tokens.colors.textSecondary,
    fontSize: 12,
  },
  rootValue: {
    color: tokens.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: tokens.colors.accentGold,
    borderRadius: 0,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    flex: 1,
    backgroundColor: tokens.colors.bgElevated,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: tokens.colors.accentGold,
    borderRadius: 0,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 14,
  },
  actionText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 13,
  },
  actionTextSecondary: {
    color: tokens.colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  status: {
    color: tokens.colors.textSecondary,
    fontSize: 12,
  },
  comingSoonOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  comingSoonScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.78)',
  },
  comingSoonCard: {
    backgroundColor: 'rgba(17,17,17,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.28)',
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 10,
  },
  comingSoonTitle: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  comingSoonBody: {
    color: '#d1d5db',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  comingSoonPriceCard: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 4,
  },
  comingSoonPriceLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  comingSoonPriceValue: {
    color: '#c9a84c',
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -2,
  },
  comingSoonPriceMeta: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 18,
  },
  comingSoonNote: {
    color: '#e8d48b',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  comingSoonFootnote: {
    color: '#9ca3af',
    fontSize: 11,
    lineHeight: 16,
  },
});
