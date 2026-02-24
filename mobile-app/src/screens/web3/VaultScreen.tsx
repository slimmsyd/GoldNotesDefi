import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getProtocolStatusHistory } from '../../lib/protocol/status-client';
import { ProtocolAuditRecord } from '../../lib/api/types';
import { tokens } from '../../theme/tokens';

function shortRoot(value: string | undefined): string {
  if (!value) return '—';
  if (value.length < 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export function VaultScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState('Loading vault proof trail...');
  const [history, setHistory] = useState<ProtocolAuditRecord[]>([]);
  const [summary, setSummary] = useState({
    solvency: 'UNKNOWN',
    ratio: null as number | null,
    totalSupply: 0,
    reserves: 0,
    totalBatches: 0,
  });

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await getProtocolStatusHistory();
      if (!response.success || !response.data) {
        setStatus(response.error || 'Vault data unavailable');
        return;
      }

      const audits = response.data.offChain.auditHistory || [];
      setHistory(audits);
      setSummary({
        solvency: response.data.solvency.status,
        ratio: response.data.solvency.ratio,
        totalSupply: response.data.onChain.totalSupply,
        reserves: response.data.onChain.provenReserves,
        totalBatches: response.data.offChain.totalBatches,
      });
      setStatus(`Loaded ${audits.length} recent proof records`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load vault status');
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
    if (summary.ratio === null) return '∞';
    return summary.ratio.toFixed(2);
  }, [summary.ratio]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={styles.title}>Vault Verification</Text>
      <Text style={styles.subtitle}>Mobile proof trail for reserve and solvency visibility.</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Health Snapshot</Text>
        <Text style={styles.summaryLine}>Solvency: {summary.solvency}</Text>
        <Text style={styles.summaryLine}>Ratio: {ratioLabel}</Text>
        <Text style={styles.summaryLine}>Supply: {summary.totalSupply}</Text>
        <Text style={styles.summaryLine}>Reserves: {summary.reserves}</Text>
        <Text style={styles.summaryLine}>Batches: {summary.totalBatches}</Text>
      </View>

      <Pressable style={styles.refreshButton} onPress={() => void load()}>
        <Text style={styles.refreshButtonText}>{refreshing ? 'Refreshing...' : 'Refresh Proof Trail'}</Text>
      </Pressable>

      <View style={styles.list}>
        {history.length === 0 ? (
          <View style={styles.historyCard}>
            <Text style={styles.historyLabel}>No proof history returned.</Text>
          </View>
        ) : (
          history.map((item, index) => (
            <View key={`${item.id ?? item.root_hash ?? `history-${index}`}`} style={styles.historyCard}>
              <Text style={styles.historyRoot}>{shortRoot(item.root_hash)}</Text>
              <Text style={styles.historyLabel}>Serials: {item.total_serials ?? 0}</Text>
              <Text style={styles.historyMeta}>Status: {item.status || 'unknown'}</Text>
              <Text style={styles.historyMeta}>
                Anchored: {item.anchored_at ? new Date(item.anchored_at).toLocaleString() : '—'}
              </Text>
              <Text style={styles.historyMeta}>Tx: {shortRoot(item.solana_tx_hash || undefined)}</Text>
            </View>
          ))
        )}
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
    color: tokens.colors.textSecondary,
    fontSize: 13,
    marginTop: -4,
  },
  summaryCard: {
    backgroundColor: tokens.colors.bgElevated,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    borderRadius: 0,
    padding: tokens.spacing.md,
    gap: 4,
  },
  summaryTitle: {
    color: tokens.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryLine: {
    color: tokens.colors.textSecondary,
    fontSize: 13,
  },
  refreshButton: {
    backgroundColor: tokens.colors.bgElevated,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    borderRadius: 0,
    paddingVertical: 10,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: tokens.colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  list: {
    gap: tokens.spacing.sm,
  },
  historyCard: {
    backgroundColor: tokens.colors.bgElevated,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    borderRadius: 0,
    padding: tokens.spacing.md,
    gap: 2,
  },
  historyRoot: {
    color: tokens.colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  historyLabel: {
    color: tokens.colors.textSecondary,
    fontSize: 12,
  },
  historyMeta: {
    color: tokens.colors.textTertiary,
    fontSize: 11,
  },
  status: {
    color: tokens.colors.textSecondary,
    fontSize: 12,
  },
});
