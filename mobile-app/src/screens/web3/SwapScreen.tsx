import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { loadWalletSession } from '../../state/wallet';
import { apiClient } from '../../lib/api/client';
import {
  createAssociatedWgbTokenAccountInstruction,
  createBuyWgbInstruction,
  fetchSolReceiver,
  fetchWgbPriceLamports,
  getUserWgbTokenAccount,
  maybeCreateInitUserProfileInstruction,
} from '../../lib/solana/wgb-program';
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
  const [goldbackRateUsd, setGoldbackRateUsd] = useState(10.14);
  const [solPriceUsd, setSolPriceUsd] = useState(0);
  const [status, setStatus] = useState('Load rates then execute a SOL -> WGB swap.');
  const [quote, setQuote] = useState<SwapQuoteView | null>(null);
  const [result, setResult] = useState<SwapExecutionResult | null>(null);
  const [busy, setBusy] = useState(false);

  const estimatedWgb = useMemo(() => {
    const sol = Number.parseFloat(payAmountSol);
    if (!Number.isFinite(sol) || sol <= 0 || !solPriceUsd || !goldbackRateUsd) return 0;
    return Math.floor((sol * solPriceUsd) / goldbackRateUsd);
  }, [payAmountSol, solPriceUsd, goldbackRateUsd]);

  const solValueUsd = useMemo(() => {
    const sol = Number.parseFloat(payAmountSol);
    if (!Number.isFinite(sol) || sol <= 0 || !solPriceUsd) return '0.00';
    return (sol * solPriceUsd).toFixed(2);
  }, [payAmountSol, solPriceUsd]);

  const wgbValueUsd = useMemo(() => {
    if (!estimatedWgb || !goldbackRateUsd) return '0.00';
    return (estimatedWgb * goldbackRateUsd).toFixed(2);
  }, [estimatedWgb, goldbackRateUsd]);

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
      const computedWgb = Math.floor((payAmount * sol.price) / goldback.rate);

      setQuote({
        payToken: 'SOL',
        payAmountSol: payAmount,
        solPriceUsd: sol.price,
        goldbackRateUsd: goldback.rate,
        estimatedWgb: computedWgb,
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
      const receiveAmount = estimatedWgb;
      if (receiveAmount <= 0) {
        throw new Error('Enter a larger SOL amount. Minimum output is 1 WGB.');
      }

      const connection = new Connection(env.rpcEndpoint, 'confirmed');
      const [solReceiver, _priceLamports, userTokenAccount, blockhashInfo] = await Promise.all([
        fetchSolReceiver(connection),
        fetchWgbPriceLamports(connection),
        getUserWgbTokenAccount(payer),
        connection.getLatestBlockhash('confirmed'),
      ]);

      const tx = new Transaction();
      tx.feePayer = payer;
      tx.recentBlockhash = blockhashInfo.blockhash;

      const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
      if (!tokenAccountInfo) {
        tx.add(createAssociatedWgbTokenAccountInstruction(payer, payer, userTokenAccount));
      }

      const initProfileIx = await maybeCreateInitUserProfileInstruction(connection, payer);
      if (initProfileIx) {
        tx.add(initProfileIx);
      }

      tx.add(createBuyWgbInstruction(payer, userTokenAccount, solReceiver, BigInt(receiveAmount)));

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
        purchasedWgb: receiveAmount,
      });
      setStatus('Swap confirmed on-chain.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Swap failed');
    } finally {
      setBusy(false);
    }
  }, [estimatedWgb]);

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">

      {/* Top action row */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 }}>
        <Pressable style={styles.ghostButton} onPress={() => void loadRates()} disabled={busy}>
          <Text style={styles.ghostButtonText}>{busy ? 'Working...' : 'Refresh Rates'}</Text>
        </Pressable>
      </View>

      <View style={styles.mainWrapper}>
        {/* Header Region */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Swap</Text>
          <Text style={styles.stepIndicator}>1/4</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressSegment, styles.progressActive]} />
          <View style={styles.progressSegment} />
          <View style={styles.progressSegment} />
          <View style={styles.progressSegment} />
        </View>

        <Text style={styles.description}>Select a token and enter the amount to swap</Text>

        {/* Tokens Container */}
        <View style={styles.tokensContainer}>

          {/* Top Token (Pay) */}
          <View style={styles.tokenBox}>
            <View style={styles.tokenTopRow}>
              <View style={styles.tokenSelectorPill}>
                <View style={[styles.currencyIcon, { backgroundColor: '#3b82f6' }]}>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>S</Text>
                </View>
                <Text style={styles.tokenSymbol}>SOL</Text>
                <Text style={styles.selectorCaret}>⌄</Text>
              </View>
              <TextInput
                style={styles.amountInput}
                keyboardType="decimal-pad"
                autoCapitalize="none"
                value={payAmountSol}
                onChangeText={setPayAmountSol}
                placeholder="0"
                placeholderTextColor="rgba(255,255,255,0.2)"
              />
            </View>
            <View style={styles.tokenBottomRow}>
              <Text style={styles.balanceText}>Balance: 0.00</Text>
              <Text style={styles.balanceText}>Value: ${solValueUsd}</Text>
            </View>
          </View>

          {/* Floating Swap Arrow */}
          <View style={styles.swapArrowWrapper}>
            <View style={styles.swapArrowCircle}>
              <Text style={styles.swapArrowIcon}>↑↓</Text>
            </View>
          </View>

          {/* Bottom Token (Receive) */}
          <View style={styles.tokenBox}>
            <View style={styles.tokenTopRow}>
              <View style={styles.tokenSelectorPill}>
                <View style={[styles.currencyIcon, { backgroundColor: '#c9a84c' }]}>
                  <Text style={{ color: 'black', fontWeight: 'bold', fontSize: 13 }}>W</Text>
                </View>
                <Text style={styles.tokenSymbol}>WGB</Text>
              </View>
              <Text style={styles.amountOutput}>{estimatedWgb || '0'}</Text>
            </View>
            <View style={styles.tokenBottomRow}>
              <Text style={styles.balanceText}>Balance: 0.00</Text>
              <Text style={styles.balanceText}>Value: ${wgbValueUsd}</Text>
            </View>
          </View>

        </View>

        {/* Rate & Network Info */}
        <View style={styles.infoBlock}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rate</Text>
            <Text style={styles.infoValue}>1 WGB ≈ {(goldbackRateUsd / Math.max(0.0001, solPriceUsd)).toFixed(4)} SOL</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Network</Text>
            <Text style={styles.infoValueGold}>{env.solanaNetwork}</Text>
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>
            SOL rail executes natively on network. Route: SOL wallet transfer → Mint WGB directly on-chain.
          </Text>
        </View>

        {/* Execute Button */}
        <Pressable
          style={[styles.executeButton, busy && styles.executeButtonDisabled]}
          onPress={() => void executeSwap()}
          disabled={busy}
        >
          <Text style={styles.executeButtonText}>{busy ? 'Processing...' : 'Review Swap'}</Text>
        </Pressable>

      </View>

      {/* Result Card (Preserved functionality) */}
      {result ? (
        <View style={[styles.mainWrapper, { marginTop: 24 }]}>
          <Text style={[styles.title, { marginBottom: 16 }]}>Swap Confirmed</Text>
          <Text style={[styles.balanceText, { color: 'white', marginBottom: 8 }]}>Purchased: {result.purchasedWgb} WGB</Text>
          <Text style={styles.balanceText}>Tx: {result.txSignature.slice(0, 14)}...</Text>
          <Pressable onPress={() => void Linking.openURL(result.explorerUrl)} style={{ marginTop: 16 }}>
            <Text style={{ color: '#c9a84c', fontWeight: '700' }}>Open on Solscan</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={[styles.status, { marginTop: 20, textAlign: 'center' }]}>{status}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.lg,
    paddingTop: 40,
    backgroundColor: '#0a0a0a',
    minHeight: '100%',
  },
  mainWrapper: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  stepIndicator: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
  },
  progressActive: {
    backgroundColor: '#c9a84c',
  },
  description: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 24,
  },
  tokensContainer: {
    position: 'relative',
    gap: 8,
    marginBottom: 24,
  },
  tokenBox: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    minHeight: 120,
  },
  tokenTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tokenSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  currencyIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  tokenSymbol: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 6,
  },
  selectorCaret: {
    color: '#9ca3af',
    fontSize: 14,
  },
  amountInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 42,
    fontWeight: '600',
    color: '#ffffff',
    padding: 0,
    height: 50,
  },
  amountOutput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 42,
    fontWeight: '600',
    color: '#6b7280',
  },
  tokenBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
  },
  swapArrowWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -20,
    alignItems: 'center',
    zIndex: 10,
  },
  swapArrowCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#c9a84c',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#111111', // Matches the bgElevated color closely to visually 'cut' the black boxes
  },
  swapArrowIcon: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: '800',
  },
  infoBlock: {
    gap: 12,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoValueGold: {
    color: '#c9a84c',
    fontSize: 14,
    fontWeight: '600',
  },
  messageBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  messageText: {
    color: '#93c5fd',
    fontSize: 13,
    lineHeight: 20,
  },
  executeButton: {
    backgroundColor: '#c9a84c',
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
  },
  executeButtonDisabled: {
    opacity: 0.6,
  },
  executeButtonText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: '700',
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  ghostButtonText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  status: {
    color: '#6b7280',
    fontSize: 12,
  },
});
