import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { getOrders, getLoyaltyBalance } from '../../lib/auth/auth-client';

export function OrdersScreen() {
  const [output, setOutput] = useState('Run checks after authentication.');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Orders + Loyalty</Text>

      <Pressable
        style={styles.button}
        onPress={async () => {
          try {
            const orders = await getOrders();
            setOutput(JSON.stringify(orders, null, 2));
          } catch (error) {
            setOutput(error instanceof Error ? error.message : 'Orders request failed');
          }
        }}
      >
        <Text style={styles.buttonText}>Fetch /api/orders</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={async () => {
          try {
            const loyalty = await getLoyaltyBalance();
            setOutput(JSON.stringify(loyalty, null, 2));
          } catch (error) {
            setOutput(error instanceof Error ? error.message : 'Loyalty request failed');
          }
        }}
      >
        <Text style={styles.buttonText}>Fetch /api/loyalty/balance</Text>
      </Pressable>

      <View style={styles.outputWrap}>
        <Text style={styles.output}>{output}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  button: { backgroundColor: '#111', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  buttonText: { color: 'white', fontWeight: '600' },
  outputWrap: { marginTop: 8, backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10 },
  output: { fontFamily: 'Courier', fontSize: 11, color: '#444' },
});
