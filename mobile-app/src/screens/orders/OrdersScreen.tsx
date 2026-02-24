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

      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>Recent Orders</Text>
        {(orders?.orders || []).slice(0, 8).map((order) => (
          <View key={order.id} style={styles.orderRow}>
            <View style={styles.orderLeft}>
              <Text style={styles.orderTitle}>{order.orderNumber || order.id}</Text>
              <Text style={styles.orderMeta}>
                {order.source.toUpperCase()} • {order.status}
              </Text>
            </View>
            <Text style={styles.orderPrice}>${order.totalAmount.toFixed(2)}</Text>
          </View>
        ))}
        {(!orders?.orders || orders.orders.length === 0) && (
          <Text style={styles.emptyText}>No previous orders found.</Text>
        )}
      </View>

      <Pressable style={styles.button} onPress={() => void refresh()} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Refreshing...' : 'Refresh Orders'}</Text>
      </Pressable>

      <Text style={styles.status}>{status}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: 40,
    paddingBottom: 44,
    gap: tokens.spacing.lg,
    backgroundColor: '#0a0a0a',
    flexGrow: 1,
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: tokens.spacing.md,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 32,
    padding: 24,
    gap: 8,
  },
  cardLabel: {
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 11,
    fontWeight: '800',
  },
  cardValue: {
    color: '#c9a84c',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  listContainer: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 32,
    padding: 24,
    gap: 16,
    marginTop: tokens.spacing.sm,
  },
  listTitle: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 24,
    padding: 16,
  },
  orderLeft: {
    flex: 1,
    gap: 4,
  },
  orderTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  orderMeta: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  orderPrice: {
    color: '#c9a84c',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  meta: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#c9a84c',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing.md,
  },
  buttonText: {
    color: '#0a0a0a',
    fontWeight: '800',
    fontSize: 15,
  },
  status: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 12,
    marginTop: 16,
  },
});
