import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { loadWalletSession } from '../../state/wallet';
import {
  clearPendingRedemption,
  loadPendingRedemption,
  PendingRedemptionState,
  savePendingRedemption,
} from '../../state/redemption';
import {
  createBurnW3bInstruction,
  fetchUserW3bBalance,
  generateRequestId,
  getUserW3bTokenAccount,
  maybeCreateInitUserProfileInstruction,
} from '../../lib/solana/w3b-program';
import { signAndSendTransaction } from '../../lib/wallet/mwa';
import { createRedemption, getRedemptionStatus } from '../../lib/redemption/redemption-client';
import { RedemptionStatusItem } from '../../lib/api/types';
import { env } from '../../config/env';
import { tokens } from '../../theme/tokens';

type RedeemStep = 'input' | 'shipping' | 'processing' | 'success';

function shortAddress(value: string | null): string {
  if (!value) return 'Not connected';
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function RedeemScreen() {
  const [step, setStep] = useState<RedeemStep>('input');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [amount, setAmount] = useState('1');
  const [w3bBalance, setW3bBalance] = useState<bigint>(BigInt(0));
  const [status, setStatus] = useState('Connect wallet to start redeem.');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<RedemptionStatusItem[]>([]);
  const [latestSignature, setLatestSignature] = useState<string | null>(null);

  const [shippingName, setShippingName] = useState('Mobile Buyer');
  const [shippingAddress, setShippingAddress] = useState('123 Gold St');
  const [shippingCity, setShippingCity] = useState('Salt Lake City');
  const [shippingState, setShippingState] = useState('UT');
  const [shippingZip, setShippingZip] = useState('84101');
  const [shippingCountry, setShippingCountry] = useState('US');

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const session = await loadWalletSession();
      if (!session.walletAddress) {
        setWalletAddress(null);
        setStatus('Connect wallet to start redeem.');
        setHistory([]);
        setW3bBalance(BigInt(0));
        return;
      }

      setWalletAddress(session.walletAddress);
      const connection = new Connection(env.rpcEndpoint, 'confirmed');
      const owner = new PublicKey(session.walletAddress);
      const [balance, redemption] = await Promise.all([
        fetchUserW3bBalance(connection, owner),
        getRedemptionStatus(session.walletAddress),
      ]);

      setW3bBalance(balance);
      setHistory(redemption.requests || []);
      setStatus('Redeem status synced');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to refresh redeem status');
    } finally {
      setBusy(false);
    }
  }, []);

  const finalizePending = useCallback(
    async (pending: PendingRedemptionState, connectedWallet: string) => {
      await createRedemption({
        request_id: Number.parseInt(pending.requestId, 10),
        amount: pending.amount,
        burn_tx_hash: pending.txSignature,
        shipping_name: pending.shippingName,
        shipping_address: pending.shippingAddress,
        shipping_city: pending.shippingCity,
        shipping_state: pending.shippingState,
        shipping_zip: pending.shippingZip,
        shipping_country: pending.shippingCountry,
      });
      setLatestSignature(pending.txSignature);
      await clearPendingRedemption();
      setStatus(`Redeem request submitted for ${shortAddress(connectedWallet)}`);
      setStep('success');
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await refresh();

        const session = await loadWalletSession();
        if (!session.walletAddress) return;

        const pending = await loadPendingRedemption();
        if (!pending) return;

        try {
          setStatus('Finalizing pending redemption...');
          await finalizePending(pending, session.walletAddress);
          await refresh();
        } catch (error) {
          setStatus(error instanceof Error ? `Pending redemption failed: ${error.message}` : 'Pending redemption failed');
        }
      })();
    }, [finalizePending, refresh])
  );

  const canContinueShipping = useMemo(() => {
    const amountInt = Number.parseInt(amount, 10);
    return amountInt > 0 && BigInt(amountInt) <= w3bBalance;
  }, [amount, w3bBalance]);

  const canSubmitShipping = useMemo(() => {
    return Boolean(
      shippingName.trim() &&
      shippingAddress.trim() &&
      shippingCity.trim() &&
      shippingState.trim() &&
      shippingZip.trim() &&
      shippingCountry.trim()
    );
  }, [shippingAddress, shippingCity, shippingCountry, shippingName, shippingState, shippingZip]);

  const executeRedeem = useCallback(async () => {
    setBusy(true);
    setStep('processing');
    try {
      const session = await loadWalletSession();
      if (!session.walletAddress) {
        throw new Error('Connect wallet first');
      }

      const owner = new PublicKey(session.walletAddress);
      const redeemAmount = Number.parseInt(amount, 10);
      if (!Number.isFinite(redeemAmount) || redeemAmount <= 0) {
        throw new Error('Invalid redemption amount');
      }

      const requestId = generateRequestId();
      const connection = new Connection(env.rpcEndpoint, 'confirmed');
      const [tokenAccount, blockhashInfo] = await Promise.all([
        getUserW3bTokenAccount(owner),
        connection.getLatestBlockhash('confirmed'),
      ]);

      const tx = new Transaction();
      tx.feePayer = owner;
      tx.recentBlockhash = blockhashInfo.blockhash;

      const initProfileIx = await maybeCreateInitUserProfileInstruction(connection, owner);
      if (initProfileIx) {
        tx.add(initProfileIx);
      }

      tx.add(createBurnW3bInstruction(owner, tokenAccount, BigInt(redeemAmount), requestId));
      const simulation = await connection.simulateTransaction(tx);
      if (simulation.value.err) {
        throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }

      setStatus('Simulation passed. Requesting wallet signature...');
      const txSignature = await signAndSendTransaction(tx, session.walletAddress);
      await connection.confirmTransaction({ signature: txSignature, ...blockhashInfo }, 'confirmed');

      const pending: PendingRedemptionState = {
        requestId: requestId.toString(),
        amount: redeemAmount,
        txSignature,
        shippingName,
        shippingAddress,
        shippingCity,
        shippingState,
        shippingZip,
        shippingCountry,
      };
      await savePendingRedemption(pending);
      await finalizePending(pending, session.walletAddress);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Redemption failed');
      setStep('shipping');
    } finally {
      setBusy(false);
    }
  }, [
    amount,
    finalizePending,
    refresh,
    shippingAddress,
    shippingCity,
    shippingCountry,
    shippingName,
    shippingState,
    shippingZip,
  ]);

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <Text style={styles.title}>Redeem W3B</Text>
      <Text style={styles.subtitle}>Burn tokens to request physical GoldBack fulfillment.</Text>

      <View style={styles.card}>
        <Text style={styles.meta}>Wallet: {shortAddress(walletAddress)}</Text>
        <Text style={styles.meta}>Balance: {w3bBalance.toString()} W3B</Text>
      </View>

      {step === 'input' ? (
        <View style={styles.card}>
          <Text style={styles.label}>Amount to Redeem (W3B)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={amount}
            onChangeText={setAmount}
            autoCapitalize="none"
          />
          <Pressable
            style={[styles.primaryButton, !canContinueShipping ? styles.buttonDisabled : null]}
            disabled={!canContinueShipping || busy}
            onPress={() => setStep('shipping')}
          >
            <Text style={styles.primaryButtonText}>Continue to Shipping</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'shipping' || step === 'processing' || step === 'success' ? (
        <View style={styles.card}>
          <Text style={styles.label}>Shipping Details</Text>
          <TextInput style={styles.input} value={shippingName} onChangeText={setShippingName} placeholder="Name" />
          <TextInput
            style={styles.input}
            value={shippingAddress}
            onChangeText={setShippingAddress}
            placeholder="Address"
          />
          <TextInput style={styles.input} value={shippingCity} onChangeText={setShippingCity} placeholder="City" />
          <TextInput style={styles.input} value={shippingState} onChangeText={setShippingState} placeholder="State" />
          <TextInput style={styles.input} value={shippingZip} onChangeText={setShippingZip} placeholder="ZIP" />
          <TextInput
            style={styles.input}
            value={shippingCountry}
            onChangeText={setShippingCountry}
            placeholder="Country"
          />

          <Pressable
            style={[styles.primaryButton, !canSubmitShipping ? styles.buttonDisabled : null]}
            disabled={!canSubmitShipping || busy}
            onPress={() => void executeRedeem()}
          >
            <Text style={styles.primaryButtonText}>{busy ? 'Processing...' : 'Burn + Submit Redeem'}</Text>
          </Pressable>

          {step !== 'processing' ? (
            <Pressable style={styles.secondaryButton} onPress={() => setStep('input')}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {latestSignature ? (
        <View style={styles.card}>
          <Text style={styles.label}>Latest Burn Tx</Text>
          <Text style={styles.meta}>{latestSignature}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Redemption History</Text>
        {history.length === 0 ? (
          <Text style={styles.meta}>No requests yet.</Text>
        ) : (
          history.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <Text style={styles.historyPrimary}>
                {item.amount} W3B • status {item.status}
              </Text>
              <Text style={styles.historyMeta}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
          ))
        )}
      </View>

      <Pressable style={styles.secondaryButton} onPress={() => void refresh()}>
        <Text style={styles.secondaryButtonText}>{busy ? 'Refreshing...' : 'Refresh Status'}</Text>
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
    color: tokens.colors.textSecondary,
    fontSize: 13,
    marginTop: -4,
  },
  card: {
    backgroundColor: tokens.colors.bgElevated,
    borderColor: tokens.colors.hairline,
    borderWidth: 1,
    borderRadius: 0,
    padding: tokens.spacing.md,
    gap: 6,
  },
  label: {
    color: tokens.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.bgMuted,
  },
  meta: {
    color: tokens.colors.textSecondary,
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: tokens.colors.accentGold,
    borderRadius: 0,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryButton: {
    backgroundColor: tokens.colors.bgElevated,
    borderColor: tokens.colors.hairline,
    borderWidth: 1,
    borderRadius: 0,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: tokens.colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  historyRow: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.hairline,
    paddingTop: 8,
    marginTop: 4,
    borderRadius: 0,
  },
  historyPrimary: {
    color: tokens.colors.textPrimary,
    fontWeight: '700',
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
