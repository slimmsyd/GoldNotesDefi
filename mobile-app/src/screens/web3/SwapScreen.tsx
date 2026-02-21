import { useCallback, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { loadWalletSession } from '../../state/wallet';
import { apiClient } from '../../lib/api/client';
import {
  createAssociatedW3bTokenAccountInstruction,
  createBuyW3bInstruction,
  fetchSolReceiver,
  fetchW3bPriceLamports,
  getUserW3bTokenAccount,
  maybeCreateInitUserProfileInstruction,
} from '../../lib/solana/w3b-program';
import { signAndSendTransaction } from '../../lib/wallet/mwa';
import { env } from '../../config/env';
import { SwapExecutionResult, SwapQuoteView } from '../../lib/api/types';
import { tokens } from '../../theme/tokens';

interface GoldbackRateResponse {
  success: boolean;
  rate: number;
  minutesSinceUpdate: number | null;
}

interface SolPriceResponse {
  success: boolean;
  price: number;
}

function toExplorerUrl(signature: string): string {
  const cluster = env.solanaNetwork === 'mainnet-beta' ? '' : `?cluster=${env.solanaNetwork}`;
  return `https://solscan.io/tx/${signature}${cluster}`;
}

export function SwapScreen() {
  const [payAmountSol, setPayAmountSol] = useState('0.10');
  const [goldbackRateUsd, setGoldbackRateUsd] = useState(9.02);
  const [solPriceUsd, setSolPriceUsd] = useState(0);
  const [status, setStatus] = useState('Load rates then execute a SOL -> W3B swap.');
  const [quote, setQuote] = useState<SwapQuoteView | null>(null);
  const [result, setResult] = useState<SwapExecutionResult | null>(null);
  const [busy, setBusy] = useState(false);

  const estimatedW3b = useMemo(() => {
    const sol = Number.parseFloat(payAmountSol);
    if (!Number.isFinite(sol) || sol <= 0 || !solPriceUsd || !goldbackRateUsd) return 0;
    return Math.floor((sol * solPriceUsd) / goldbackRateUsd);
  }, [payAmountSol, solPriceUsd, goldbackRateUsd]);

  const loadRates = useCallback(async () => {
    setBusy(true);
    try {
      const [goldback, sol] = await Promise.all([
        apiClient.get<GoldbackRateResponse>('/api/goldback-rate'),
        apiClient.get<SolPriceResponse>('/api/sol-price'),
      ]);

      if (!goldback.success || !sol.success || !sol.price) {
        throw new Error('Unable to load current market rates');
      }

      setGoldbackRateUsd(goldback.rate);
      setSolPriceUsd(sol.price);
      const payAmount = Number.parseFloat(payAmountSol) || 0;
      const computedW3b = Math.floor((payAmount * sol.price) / goldback.rate);

      setQuote({
        payToken: 'SOL',
        payAmountSol: payAmount,
        solPriceUsd: sol.price,
        goldbackRateUsd: goldback.rate,
        estimatedW3b: computedW3b,
        verifiedAt: new Date().toISOString(),
      });
      setStatus('Rates verified and quote refreshed.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load rates');
    } finally {
      setBusy(false);
    }
  }, [payAmountSol]);

  const executeSwap = useCallback(async () => {
    setBusy(true);
    try {
      const session = await loadWalletSession();
      if (!session.walletAddress) {
        throw new Error('Connect wallet first from the Wallet button in header.');
      }

      const payer = new PublicKey(session.walletAddress);
      const receiveAmount = estimatedW3b;
      if (receiveAmount <= 0) {
        throw new Error('Enter a larger SOL amount. Minimum output is 1 W3B.');
      }

      const connection = new Connection(env.rpcEndpoint, 'confirmed');
      const [solReceiver, _priceLamports, userTokenAccount, blockhashInfo] = await Promise.all([
        fetchSolReceiver(connection),
        fetchW3bPriceLamports(connection),
        getUserW3bTokenAccount(payer),
        connection.getLatestBlockhash('confirmed'),
      ]);

      const tx = new Transaction();
      tx.feePayer = payer;
      tx.recentBlockhash = blockhashInfo.blockhash;

      const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
      if (!tokenAccountInfo) {
        tx.add(createAssociatedW3bTokenAccountInstruction(payer, payer, userTokenAccount));
      }

      const initProfileIx = await maybeCreateInitUserProfileInstruction(connection, payer);
      if (initProfileIx) {
        tx.add(initProfileIx);
      }

      tx.add(createBuyW3bInstruction(payer, userTokenAccount, solReceiver, BigInt(receiveAmount)));

      const simulation = await connection.simulateTransaction(tx);
      if (simulation.value.err) {
        throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }

      setStatus('Simulation passed. Requesting wallet signature...');
      const signature = await signAndSendTransaction(tx, session.walletAddress);
      await connection.confirmTransaction({ signature, ...blockhashInfo }, 'confirmed');

      const explorerUrl = toExplorerUrl(signature);
      setResult({
        txSignature: signature,
        explorerUrl,
        purchasedW3b: receiveAmount,
      });
      setStatus('Swap confirmed on-chain.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Swap failed');
    } finally {
      setBusy(false);
    }
  }, [estimatedW3b]);

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <Text style={styles.title}>Swap SOL → W3B</Text>
      <Text style={styles.subtitle}>SOL-only mobile swap path with pre-send simulation.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>SOL Amount</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          autoCapitalize="none"
          value={payAmountSol}
          onChangeText={setPayAmountSol}
        />
        <Text style={styles.meta}>Estimated W3B output: {estimatedW3b}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.meta}>SOL Price: ${solPriceUsd.toFixed(2)}</Text>
        <Text style={styles.meta}>GoldBack Rate: ${goldbackRateUsd.toFixed(2)}</Text>
        <Text style={styles.meta}>Network: {env.solanaNetwork}</Text>
      </View>

      <Pressable style={styles.secondaryButton} onPress={() => void loadRates()} disabled={busy}>
        <Text style={styles.secondaryButtonText}>{busy ? 'Working...' : 'Refresh Quote'}</Text>
      </Pressable>

      <Pressable style={styles.primaryButton} onPress={() => void executeSwap()} disabled={busy}>
        <Text style={styles.primaryButtonText}>{busy ? 'Processing...' : 'Execute Swap'}</Text>
      </Pressable>

      {quote ? (
        <View style={styles.card}>
          <Text style={styles.label}>Quote</Text>
          <Text style={styles.meta}>Pay: {quote.payAmountSol.toFixed(4)} SOL</Text>
          <Text style={styles.meta}>Receive: {quote.estimatedW3b} W3B</Text>
          <Text style={styles.meta}>Verified: {new Date(quote.verifiedAt).toLocaleTimeString()}</Text>
        </View>
      ) : null}

      {result ? (
        <View style={styles.card}>
          <Text style={styles.label}>Last Swap</Text>
          <Text style={styles.meta}>Purchased: {result.purchasedW3b} W3B</Text>
          <Text style={styles.meta}>Tx: {result.txSignature.slice(0, 14)}...</Text>
          <Pressable onPress={() => void Linking.openURL(result.explorerUrl)}>
            <Text style={styles.link}>Open on Solscan</Text>
          </Pressable>
        </View>
      ) : null}

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
    fontSize: 16,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.bgElevated,
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
  },
  primaryButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 14,
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
  status: {
    color: tokens.colors.textSecondary,
    fontSize: 12,
  },
  link: {
    color: tokens.colors.accentGold,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 4,
  },
});
