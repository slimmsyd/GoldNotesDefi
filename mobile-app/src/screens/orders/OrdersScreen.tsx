import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getOrders, getLoyaltyBalance } from '../../lib/auth/auth-client';
import { LoyaltyBalanceResponse, OrdersResponse } from '../../lib/api/types';
import { tokens } from '../../theme/tokens';

export function OrdersScreen() {
  const [orders, setOrders] = useState<OrdersResponse | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyBalanceResponse | null>(null);
  const [status, setStatus] = useState('Syncing orders and loyalty...');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [ordersResp, loyaltyResp] = await Promise.all([getOrders(), getLoyaltyBalance()]);
      setOrders(ordersResp);
      setLoyalty(loyaltyResp);
      setStatus('Orders synced');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load orders');
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const latestOrder = useMemo(() => orders?.orders?.[0] || null, [orders?.orders]);
  const latestLoyaltyEvent = useMemo(() => loyalty?.events?.[0] || null, [loyalty?.events]);

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <Text style={styles.title}>Orders + Loyalty</Text>
      <Text style={styles.subtitle}>Authenticated order history and points state.</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Loyalty Balance</Text>
        <Text style={styles.cardValue}>{loyalty?.balance ?? 0} pts</Text>
        {latestLoyaltyEvent ? (
          <Text style={styles.meta}>
            Latest: {latestLoyaltyEvent.points > 0 ? '+' : ''}
            {latestLoyaltyEvent.points} from {latestLoyaltyEvent.source}
          </Text>
        ) : (
          <Text style={styles.meta}>No loyalty events yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Latest Receipt</Text>
        {latestOrder ? (
          <>
            <Text style={styles.cardValue}>{latestOrder.orderNumber || latestOrder.id}</Text>
            <Text style={styles.meta}>Source: {latestOrder.source}</Text>
            <Text style={styles.meta}>Status: {latestOrder.status}</Text>
            <Text style={styles.meta}>Total: ${latestOrder.totalAmount.toFixed(2)}</Text>
            <Text style={styles.meta}>
              Items: {latestOrder.items.reduce((sum, item) => sum + item.quantity, 0)}
            </Text>
            {latestLoyaltyEvent?.orderId ? (
              <Text style={styles.meta}>Points event order: {latestLoyaltyEvent.orderId}</Text>
            ) : null}
            {latestLoyaltyEvent?.sourceRef ? (
              <Text style={styles.meta}>
                Tx/Source Ref: {latestLoyaltyEvent.sourceRef.slice(0, 14)}...
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.meta}>No orders available yet.</Text>
        )}
      </View>

      {(orders?.orders || []).slice(0, 8).map((order) => (
        <View key={order.id} style={styles.orderRow}>
          <Text style={styles.orderTitle}>{order.orderNumber || order.id}</Text>
          <Text style={styles.meta}>
            {order.source.toUpperCase()} • {order.status} • ${order.totalAmount.toFixed(2)}
          </Text>
        </View>
      ))}

      <Pressable style={styles.button} onPress={() => void refresh()} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Refreshing...' : 'Refresh Orders + Loyalty'}</Text>
      </Pressable>

      <Text style={styles.status}>{status}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 10,
    backgroundColor: tokens.colors.bgBase,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: tokens.colors.textPrimary,
  },
  subtitle: {
    color: tokens.colors.textSecondary,
    fontSize: 12,
  },
  card: {
    backgroundColor: tokens.colors.bgElevated,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    borderRadius: 0,
    padding: 12,
    gap: 3,
  },
  cardLabel: {
    color: tokens.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
    fontWeight: '700',
  },
  cardValue: {
    color: tokens.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  orderRow: {
    backgroundColor: tokens.colors.bgElevated,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    borderRadius: 0,
    padding: 10,
    gap: 2,
  },
  orderTitle: {
    color: tokens.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    color: tokens.colors.textSecondary,
    fontSize: 12,
  },
  button: {
    backgroundColor: tokens.colors.accentGold,
    borderRadius: 0,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 13,
  },
  status: {
    color: tokens.colors.textSecondary,
    fontSize: 12,
  },
});
