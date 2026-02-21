import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Connection, PublicKey } from '@solana/web3.js';
import { env } from '../../config/env';
import { getUserProfile, loginWithDevSigner, loginWithWalletSignature } from '../../lib/auth/auth-client';
import { clearAuth, getAuth } from '../../state/auth';
import { clearWalletSession, loadWalletSession, markWalletConnected } from '../../state/wallet';
import { fetchUserW3bBalance } from '../../lib/solana/w3b-program';
import { tokens } from '../../theme/tokens';

export function ProfileScreen() {
  const [wallet, setWallet] = useState('');
  const [walletAuthToken, setWalletAuthToken] = useState<string | null>(null);
  const [status, setStatus] = useState('Connect wallet to start');
  const [profileJson, setProfileJson] = useState('');
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [w3bBalance, setW3bBalance] = useState<number | null>(null);

  const refreshState = useCallback(async () => {
    const [auth, session] = await Promise.all([getAuth(), loadWalletSession()]);
    const walletAddress = session.walletAddress || auth?.wallet || '';
    setWallet(walletAddress);
    setWalletAuthToken(session.authToken || auth?.token || null);

    if (!walletAddress) {
      setStatus('Connect wallet to start');
      setSolBalance(null);
      setW3bBalance(null);
      return;
    }

    try {
      const connection = new Connection(env.rpcEndpoint, 'confirmed');
      const publicKey = new PublicKey(walletAddress);
      const [solLamports, w3bRaw] = await Promise.all([
        connection.getBalance(publicKey, 'confirmed'),
        fetchUserW3bBalance(connection, publicKey),
      ]);
      setSolBalance(solLamports / 1_000_000_000);
      setW3bBalance(Number(w3bRaw));
    } catch {
      setSolBalance(null);
      setW3bBalance(null);
    }

    if (auth?.token) {
      setStatus(`Authenticated wallet ready: ${walletAddress.slice(0, 6)}...`);
    } else {
      setStatus(`Wallet connected: ${walletAddress.slice(0, 6)}...`);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshState();
    }, [refreshState])
  );

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <Text style={styles.title}>Wallet Profile</Text>
      <Text style={styles.meta}>MWA auth is primary. Dev signer remains local-dev only.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Wallet Address</Text>
        <TextInput
          style={styles.input}
          value={wallet}
          onChangeText={setWallet}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Connect to auto-fill"
        />
        <Text style={styles.balance}>SOL: {solBalance === null ? '—' : solBalance.toFixed(4)}</Text>
        <Text style={styles.balance}>W3B: {w3bBalance === null ? '—' : w3bBalance.toLocaleString()}</Text>
        <Text style={styles.balance}>Network: {env.solanaNetwork}</Text>
      </View>

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
            await refreshState();
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
            await refreshState();
          } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Wallet auth failed');
          }
        }}
      >
        <Text style={styles.buttonText}>Sign-In With Wallet Signature</Text>
      </Pressable>

      {__DEV__ && !env.isProduction ? (
        <Pressable
          style={styles.buttonSecondary}
          onPress={async () => {
            try {
              const result = await loginWithDevSigner(wallet, env.devSignerSecret);
              setStatus(`Dev signer JWT issued. Expires: ${result.expiresAt}`);
              await refreshState();
            } catch (error) {
              setStatus(error instanceof Error ? error.message : 'Dev signer auth failed');
            }
          }}
        >
          <Text style={styles.buttonText}>Dev Signer Login</Text>
        </Pressable>
      ) : null}

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
            // Allow clearing local auth if MWA is unavailable.
          }
          await clearAuth();
          await clearWalletSession();
          setWalletAuthToken(null);
          setProfileJson('');
          setStatus('Wallet + auth cleared');
          await refreshState();
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
  container: {
    padding: 20,
    gap: 10,
    backgroundColor: tokens.colors.bgBase,
  },
  title: { fontSize: 24, fontWeight: '800', color: tokens.colors.textPrimary },
  meta: { fontSize: 12, color: tokens.colors.textSecondary, marginBottom: 2 },
  card: {
    backgroundColor: tokens.colors.bgElevated,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    padding: 12,
    gap: 4,
  },
  label: { fontSize: 12, color: tokens.colors.textTertiary, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.bgMuted,
  },
  balance: { fontSize: 12, color: tokens.colors.textSecondary },
  button: { backgroundColor: tokens.colors.accentGold, borderRadius: 0, paddingVertical: 10, paddingHorizontal: 12 },
  buttonSecondary: { backgroundColor: tokens.colors.bgElevated, borderRadius: 0, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: tokens.colors.hairline },
  buttonDanger: { backgroundColor: tokens.colors.danger, borderRadius: 0, paddingVertical: 10, paddingHorizontal: 12 },
  buttonText: { color: '#0a0a0a', fontWeight: '600' },
  status: { marginTop: 8, fontSize: 12, color: tokens.colors.textSecondary },
  code: {
    marginTop: 8,
    fontFamily: 'Courier',
    fontSize: 11,
    color: tokens.colors.textSecondary,
    backgroundColor: tokens.colors.bgMuted,
    padding: 10,
    borderRadius: 0,
  },
});
