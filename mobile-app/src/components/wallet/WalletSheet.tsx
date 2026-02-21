import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { env } from '../../config/env';
import { loginWithDevSigner, loginWithWalletSignature } from '../../lib/auth/auth-client';
import { clearAuth, getAuth } from '../../state/auth';
import { clearWalletSession, loadWalletSession, markWalletConnected } from '../../state/wallet';

interface WalletSheetProps {
  visible: boolean;
  onClose: () => void;
}

function shortAddress(address: string | null): string {
  if (!address) return 'Not connected';
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletSheet({ visible, onClose }: WalletSheetProps) {
  const [wallet, setWallet] = useState('');
  const [status, setStatus] = useState('Connect wallet to begin');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;

    void (async () => {
      const [auth, session] = await Promise.all([getAuth(), loadWalletSession()]);
      const walletAddress = session.walletAddress || auth?.wallet || '';
      setWallet(walletAddress);
      setExpiresAt(auth?.expiresAt || session.authTokenExpiresAt || null);
      setAuthToken(session.authToken || auth?.token || null);
      const isAuthenticated = Boolean(auth?.token || session.authToken);
      if (isAuthenticated && walletAddress) {
        setStatus(`Authenticated wallet ready for checkout: ${shortAddress(walletAddress)}`);
      } else if (walletAddress) {
        setStatus(`Wallet connected: ${shortAddress(walletAddress)}. Sign in to continue checkout.`);
      } else {
        setStatus('Connect wallet to begin');
      }
    })();
  }, [visible]);

  const authDetails = useMemo(
    () => ({
      walletLabel: shortAddress(wallet || null),
      connectionLabel: wallet ? 'Connected' : 'Not connected',
      authLabel: expiresAt ? 'Authenticated' : 'Not authenticated',
      expiresLabel: expiresAt || '—',
    }),
    [wallet, expiresAt]
  );

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Wallet action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Wallet</Text>
        <Text style={styles.meta}>Address: {authDetails.walletLabel}</Text>
        <Text style={styles.meta}>Connection: {authDetails.connectionLabel}</Text>
        <Text style={styles.meta}>Auth: {authDetails.authLabel}</Text>
        <Text style={styles.meta}>Token Expires: {authDetails.expiresLabel}</Text>
        <Text style={styles.hint}>Checkout flow: Connect Wallet, then Sign-In With Wallet Signature.</Text>

        <TextInput
          style={styles.input}
          value={wallet}
          onChangeText={setWallet}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Wallet Address"
          placeholderTextColor="#777"
        />

        <Pressable
          style={[styles.button, busy ? styles.buttonDisabled : null]}
          disabled={busy}
          onPress={() =>
            runAction(async () => {
              const { connectWallet } = await import('../../lib/wallet/mwa');
              const result = await connectWallet();
              await markWalletConnected(result.walletAddress, result.authToken);
              setWallet(result.walletAddress);
              setAuthToken(result.authToken);
              setStatus(`Wallet connected: ${shortAddress(result.walletAddress)}. Sign in to continue checkout.`);
            })
          }
        >
          <Text style={styles.buttonText}>Connect Wallet (MWA)</Text>
        </Pressable>

        <Pressable
          style={[styles.buttonSecondary, busy ? styles.buttonDisabled : null]}
          disabled={busy}
          onPress={() =>
            runAction(async () => {
              if (!wallet) throw new Error('Connect wallet first');
              const result = await loginWithWalletSignature(wallet);
              setExpiresAt(result.expiresAt);
              setStatus(`Wallet authenticated. Expires: ${result.expiresAt}`);
            })
          }
        >
          <Text style={styles.buttonText}>Sign-In With Wallet Signature</Text>
        </Pressable>

        {__DEV__ && !env.isProduction ? (
          <Pressable
            style={[styles.buttonSecondary, busy ? styles.buttonDisabled : null]}
            disabled={busy}
            onPress={() =>
              runAction(async () => {
                if (!wallet) throw new Error('Enter a wallet address first');
                if (!env.devSignerSecret) {
                  throw new Error('EXPO_PUBLIC_DEV_SIGNER_SECRET is not set');
                }
                const result = await loginWithDevSigner(wallet, env.devSignerSecret);
                setExpiresAt(result.expiresAt);
                setStatus(`Dev signer authenticated. Expires: ${result.expiresAt}`);
              })
            }
          >
            <Text style={styles.buttonText}>Dev Signer Login</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.buttonDanger, busy ? styles.buttonDisabled : null]}
          disabled={busy}
          onPress={() =>
            runAction(async () => {
              try {
                const { disconnectWallet } = await import('../../lib/wallet/mwa');
                await disconnectWallet(authToken).catch(() => undefined);
              } catch {
                // Keep local cleanup resilient.
              }
              await Promise.all([clearAuth(), clearWalletSession()]);
              setWallet('');
              setAuthToken(null);
              setExpiresAt(null);
              setStatus('Wallet + auth cleared');
            })
          }
        >
          <Text style={styles.buttonText}>Disconnect + Clear Auth</Text>
        </Pressable>

        <Text style={styles.status}>{status}</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    backgroundColor: '#0f1115',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: 10,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  meta: {
    color: '#d0d3d8',
    fontSize: 12,
  },
  hint: {
    color: '#94a3b8',
    fontSize: 11,
  },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#3a3f48',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 13,
    backgroundColor: '#191d24',
  },
  button: {
    marginTop: 4,
    backgroundColor: '#c6931d',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#2b2f36',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonDanger: {
    backgroundColor: '#7c2525',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  status: {
    marginTop: 4,
    color: '#d0d3d8',
    fontSize: 12,
  },
});
