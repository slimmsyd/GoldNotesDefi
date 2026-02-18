import { View, Text, StyleSheet } from 'react-native';

export function SwapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Swap (Phase 0 Shell)</Text>
      <Text style={styles.body}>On-chain buy flow wiring is scheduled after auth + emulator baseline.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 14, color: '#333' },
});
