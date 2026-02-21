import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Web3StackParamList } from '../../navigation';
import { getProtocolStatus } from '../../lib/protocol/status-client';
import { ProtocolStatusData } from '../../lib/api/types';
import { tokens } from '../../theme/tokens';

type Props = NativeStackScreenProps<Web3StackParamList, 'Dashboard'>;

function shortRoot(root: string): string {
  if (!root) return '—';
  if (root.length < 20) return root;
  return `${root.slice(0, 10)}...${root.slice(-8)}`;
}

export function DashboardScreen({ navigation }: Props) {
  const [status, setStatus] = useState('Syncing protocol status...');
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState<ProtocolStatusData | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await getProtocolStatus();
      if (!response.success || !response.data) {
        setStatus(response.error || 'Protocol status unavailable');
        setPayload(null);
        return;
      }

      setPayload(response.data);
      setStatus('Protocol status synced');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to sync protocol status');
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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={styles.title}>Protocol Dashboard</Text>
      <Text style={styles.subtitle}>Live solvency and reserve signals from /api/protocol-status.</Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Solvency</Text>
          <Text style={styles.cardValue}>{payload?.solvency.status ?? 'UNKNOWN'}</Text>
          <Text style={styles.cardMeta}>Ratio: {ratioLabel}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Supply</Text>
          <Text style={styles.cardValue}>{payload?.onChain.totalSupply ?? 0}</Text>
          <Text style={styles.cardMeta}>W3B issued</Text>
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
        <Pressable style={styles.actionButton} onPress={() => navigation.navigate('Swap')}>
          <Text style={styles.actionText}>Open Swap</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => navigation.navigate('Redeem')}>
          <Text style={styles.actionText}>Open Redeem</Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.actionButtonSecondary} onPress={() => navigation.navigate('Vault')}>
          <Text style={styles.actionTextSecondary}>Vault Proof Trail</Text>
        </Pressable>
        <Pressable style={styles.actionButtonSecondary} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.actionTextSecondary}>Wallet Profile</Text>
        </Pressable>
      </View>

      <Text style={styles.status}>{status}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
    backgroundColor: tokens.colors.bgBase,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: tokens.colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: tokens.colors.textSecondary,
    marginTop: -4,
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
});
