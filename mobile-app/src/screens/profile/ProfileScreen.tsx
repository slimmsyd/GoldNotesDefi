import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { env } from '../../config/env';
import { getUserProfile, loginWithDevSigner, loginWithWalletSignature } from '../../lib/auth/auth-client';
import { clearAuth, getAuth } from '../../state/auth';
import { clearWalletSession, loadWalletSession, markWalletConnected } from '../../state/wallet';

export function ProfileScreen() {
  const [wallet, setWallet] = useState('CrQERYcZMnENP85qZBrdimS7oz2Ura9tAPxkZJPMpbNj');
  const [walletAuthToken, setWalletAuthToken] = useState<string | null>(null);
  const [status, setStatus] = useState('Not authenticated');
  const [profileJson, setProfileJson] = useState('');

  useEffect(() => {
    void (async () => {
      const auth = await getAuth();
      const session = await loadWalletSession();
      if (session.walletAddress) {
        setWallet(session.walletAddress);
      }
      if (session.authToken) {
        setWalletAuthToken(session.authToken);
      }

      if (auth) {
        setStatus(`Authenticated as ${auth.wallet.slice(0, 6)}...`);
      } else if (session.walletAddress) {
        setStatus(`Wallet connected: ${session.walletAddress.slice(0, 6)}...`);
      }
    })();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profile + Auth</Text>
      <Text style={styles.meta}>Wallet-first auth with dev signer fallback.</Text>

      <Text style={styles.label}>Wallet Address</Text>
      <TextInput
        style={styles.input}
        value={wallet}
        onChangeText={setWallet}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Pressable
        style={styles.button}
        onPress={async () => {
          try {
            const { connectWallet } = await import('../../lib/wallet/mwa');
            const result = await connectWallet();
            setWallet(result.walletAddress);
            setWalletAuthToken(result.authToken);
            await markWalletConnected(result.walletAddress, result.authToken);
            setStatus(`Wallet connected: ${result.walletAddress.slice(0, 6)}...`);
          } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Wallet connect failed');
          }
        }}
      >
        <Text style={styles.buttonText}>Connect Wallet (MWA)</Text>
      </Pressable>

      <Pressable
        style={styles.buttonSecondary}
        onPress={async () => {
          try {
            const result = await loginWithWalletSignature(wallet);
            setStatus(`Wallet auth success. Expires: ${result.expiresAt}`);
          } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Wallet auth failed');
          }
        }}
      >
        <Text style={styles.buttonText}>Sign-In With Wallet Signature</Text>
      </Pressable>

      <Pressable
        style={styles.buttonSecondary}
        onPress={async () => {
          try {
            const result = await loginWithDevSigner(wallet, env.devSignerSecret);
            setStatus(`JWT issued. Expires: ${result.expiresAt}`);
          } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Auth failed');
          }
        }}
      >
        <Text style={styles.buttonText}>Login With Dev Signer</Text>
      </Pressable>

      <Pressable
        style={styles.buttonSecondary}
        onPress={async () => {
          try {
            const profile = await getUserProfile();
            setProfileJson(JSON.stringify(profile, null, 2));
            setStatus('Loaded /api/user/profile with bearer token');
          } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Profile load failed');
          }
        }}
      >
        <Text style={styles.buttonText}>Fetch Profile</Text>
      </Pressable>

      <Pressable
        style={styles.buttonDanger}
        onPress={async () => {
          try {
            const { disconnectWallet } = await import('../../lib/wallet/mwa');
            await disconnectWallet(walletAuthToken).catch(() => undefined);
          } catch {
            // If the native wallet module is unavailable (Expo Go), continue clearing local state.
          }
          await clearAuth();
          await clearWalletSession();
          setWalletAuthToken(null);
          setProfileJson('');
          setStatus('Wallet + auth cleared');
        }}
      >
        <Text style={styles.buttonText}>Disconnect + Clear Auth</Text>
      </Pressable>

      <Text style={styles.status}>{status}</Text>
      <Text style={styles.code}>{profileJson}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  meta: { fontSize: 12, color: '#555', marginBottom: 4 },
  label: { fontSize: 12, color: '#444' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 6,
  },
  button: { backgroundColor: '#111', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  buttonSecondary: { backgroundColor: '#2d2d2d', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  buttonDanger: { backgroundColor: '#8b1c1c', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  buttonText: { color: 'white', fontWeight: '600' },
  status: { marginTop: 8, fontSize: 12, color: '#333' },
  code: {
    marginTop: 8,
    fontFamily: 'Courier',
    fontSize: 11,
    color: '#444',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
  },
});
