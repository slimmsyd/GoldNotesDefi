import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadWalletSession } from '../../state/wallet';
import { apiClient } from '../../lib/api/client';
import { tokens } from '../../theme/tokens';

interface RedemptionStatusResponse {
  success: boolean;
  count: number;
  requests: Array<{
    id: string;
    amount: number;
    status: number;
    created_at: string;
    burn_tx_hash?: string | null;
  }>;
}

function shortAddress(value: string | null): string {
  if (!value) return 'Not connected';
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function RedeemScreen() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [latestRequest, setLatestRequest] = useState<RedemptionStatusResponse['requests'][number] | null>(null);
  const [status, setStatus] = useState('Connect wallet to load withdrawal data.');
  const [loading, setLoading] = useState(false);

  const latestCreatedAt = useMemo(() => {
    if (!latestRequest?.created_at) return '—';
    return new Date(latestRequest.created_at).toLocaleString();
  }, [latestRequest?.created_at]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const session = await loadWalletSession();
      if (!session.walletAddress) {
        setWalletAddress(null);
        setPendingCount(0);
        setLatestRequest(null);
        setStatus('Connect wallet to load withdrawal data.');
        return;
      }

      setWalletAddress(session.walletAddress);
      const response = await apiClient.get<RedemptionStatusResponse>(
        `/api/redemption/status?wallet=${encodeURIComponent(session.walletAddress)}`
      );

      const pending = response.requests.filter((item) => item.status === 0).length;
      setPendingCount(pending);
      setLatestRequest(response.requests[0] || null);
      setStatus(response.count > 0 ? 'Redemption status synced.' : 'No redemption requests yet.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load redemption status');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <Text style={styles.title}>Withdraw Hub</Text>
      <Text style={styles.subtitle}>Manage burn-to-redeem requests for physical GoldBack withdrawals.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Wallet</Text>
        <Text style={styles.value}>{shortAddress(walletAddress)}</Text>
        <Text style={styles.meta}>Pending Requests: {pendingCount}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Latest Request</Text>
        {latestRequest ? (
          <>
            <Text style={styles.value}>Amount: {latestRequest.amount} W3B</Text>
            <Text style={styles.meta}>Status Code: {latestRequest.status}</Text>
            <Text style={styles.meta}>Created: {latestCreatedAt}</Text>
          </>
        ) : (
          <Text style={styles.meta}>No request history available yet.</Text>
        )}
      </View>

      <Pressable
        style={[styles.button, !walletAddress ? styles.buttonDisabled : null]}
        disabled={!walletAddress}
        onPress={() => setStatus('Start Withdraw flow is queued for the next increment.')}
      >
        <Text style={styles.buttonText}>Start Withdraw</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => void refresh()}>
        <Text style={styles.secondaryButtonText}>{loading ? 'Refreshing...' : 'Refresh Status'}</Text>
      </Pressable>

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
    fontSize: 14,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  card: {
    backgroundColor: tokens.colors.bgElevated,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: tokens.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontWeight: '700',
  },
  value: {
    fontSize: 19,
    color: tokens.colors.textPrimary,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    color: tokens.colors.textSecondary,
  },
  button: {
    marginTop: 4,
    backgroundColor: tokens.colors.accentDark,
    borderRadius: tokens.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  secondaryButton: {
    borderRadius: tokens.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: tokens.colors.bgElevated,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
  },
  secondaryButtonText: {
    color: tokens.colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  status: {
    fontSize: 12,
    color: tokens.colors.textSecondary,
  },
});
