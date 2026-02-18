import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { apiClient } from '../../lib/api/client';

interface ProtocolStatusResponse {
  success: boolean;
  data?: {
    solvency?: { status?: string; ratio?: number | null };
    onChain?: { totalSupply?: number; provenReserves?: number };
  };
}

export function DashboardScreen() {
  const [status, setStatus] = useState('Not loaded');

  async function loadStatus() {
    try {
      const data = await apiClient.get<ProtocolStatusResponse>('/api/protocol-status');
      if (!data.success) {
        setStatus('Protocol status request failed');
        return;
      }

      const supply = data.data?.onChain?.totalSupply ?? 0;
      const reserves = data.data?.onChain?.provenReserves ?? 0;
      const solvency = data.data?.solvency?.status || 'UNKNOWN';
      setStatus(`Solvency: ${solvency} | Supply: ${supply} | Reserves: ${reserves}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load status');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Web3 Dashboard</Text>
      <Pressable style={styles.button} onPress={loadStatus}>
        <Text style={styles.buttonText}>Load Protocol Status</Text>
      </Pressable>
      <Text style={styles.body}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  button: { backgroundColor: '#111', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  buttonText: { color: 'white', fontWeight: '600' },
  body: { fontSize: 14, color: '#333' },
});
