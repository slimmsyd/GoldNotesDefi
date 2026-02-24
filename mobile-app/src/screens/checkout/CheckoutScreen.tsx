import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  clearPendingDirectCheckout,
  loadPendingDirectCheckout,
  PendingDirectCheckout,
  savePendingDirectCheckout,
} from '../../state/checkout';
import { CartItem, clearCart, loadCart, saveCart } from '../../state/cart';
import { getAuthToken } from '../../state/auth';
import { loadWalletSession } from '../../state/wallet';
import {
  clearRemoteCart,
  getRemoteCart,
  saveRemoteCart,
  updateUserProfile,
  getUserProfile,
} from '../../lib/auth/auth-client';
import { getShippingOptions } from '../../lib/checkout/shipping-client';
import { createDirectCheckout, confirmDirectCheckout } from '../../lib/checkout/direct-checkout-client';
import { buildSolDirectCheckoutTransaction } from '../../lib/solana/transactions';
import { ShippingOption } from '../../lib/api/types';
import { env } from '../../config/env';
import type { MainTabParamList } from '../../navigation';
import { tokens } from '../../theme/tokens';

type Props = BottomTabScreenProps<MainTabParamList, 'Checkout'>;
type Step = 'cart' | 'details' | 'payment';

function parseAddress(input: string): {
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
} {
  const parts = input.split(',').map((v) => v.trim());
  const shippingAddress = parts[0] || '';
  const shippingCity = parts[1] || '';
  const stateZip = parts.slice(2).join(' ').trim();
  const stateMatch = stateZip.match(/^([A-Z]{2})\s*(\d{5})?/i);
  const shippingState = stateMatch ? stateMatch[1].toUpperCase() : '';
  const shippingZip = stateMatch ? stateMatch[2] || '' : stateZip.replace(/[^0-9]/g, '').slice(0, 5);

  return { shippingAddress, shippingCity, shippingState, shippingZip };
}

function formatPriceLabel(raw: string): string {
  const unit = parseFloat(raw.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(unit)) return raw;
  return `$${unit.toFixed(2)}`;
}

export function CheckoutScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('cart');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [status, setStatus] = useState('Review your cart to continue');
  const [successSummary, setSuccessSummary] = useState<{
    orderId: string;
    txSignature: string;
    pointsAwarded: number;
    newBalance: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingShipping, setIsLoadingShipping] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [customerName, setCustomerName] = useState('Mobile Buyer');
  const [customerEmail, setCustomerEmail] = useState('buyer@example.com');
  const [shippingAddress, setShippingAddress] = useState('123 Gold St, Salt Lake City, UT 84101');
  const [isInternational, setIsInternational] = useState(false);
  const [saveShippingForLater, setSaveShippingForLater] = useState(false);
  const [profilePrefilled, setProfilePrefilled] = useState(false);
  const [hasAuthToken, setHasAuthToken] = useState(false);

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<string | null>(null);

  const directItems = useMemo(() => cartItems.filter((item) => item.source === 'direct'), [cartItems]);
  const amazonItemsCount = useMemo(
    () => cartItems.filter((item) => item.source === 'amazon').reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );
  const directSubtotal = useMemo(
    () =>
      directItems.reduce((sum, item) => {
        const unit = parseFloat(item.price.replace(/[^0-9.]/g, ''));
        return sum + (Number.isFinite(unit) ? unit : 0) * item.quantity;
      }, 0),
    [directItems]
  );

  const selectedShippingMethod = useMemo(
    () => shippingOptions.find((option) => option.id === selectedShippingMethodId) || null,
    [shippingOptions, selectedShippingMethodId]
  );
  const shippingCost = selectedShippingMethod?.cost || 0;
  const orderTotal = directSubtotal + shippingCost;

  async function persistCart(items: CartItem[]): Promise<void> {
    await saveCart(items);
    const token = await getAuthToken();
    if (token) {
      await saveRemoteCart(items).catch(() => undefined);
    }
    setCartItems(items);
  }

  async function syncCartFromRemote(): Promise<void> {
    const token = await getAuthToken();
    setHasAuthToken(Boolean(token));
    if (!token) return;

    const remote = await getRemoteCart();
    if (remote.cart && Array.isArray(remote.cart)) {
      await saveCart(remote.cart);
      setCartItems(remote.cart as CartItem[]);
    }
  }

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const localCart = await loadCart();
        setCartItems(localCart);

        try {
          await syncCartFromRemote();
        } catch {
          // Keep local cart if remote load fails.
        }
      })();
    }, [])
  );

  useEffect(() => {
    void (async () => {
      const token = await getAuthToken();
      setHasAuthToken(Boolean(token));
      if (!token) return;

      try {
        const profileResp = await getUserProfile();
        const profile = profileResp.profile;
        if (!profile) return;

        const fullAddress = [profile.shippingAddress, profile.shippingCity, profile.shippingState, profile.shippingZip]
          .filter(Boolean)
          .join(', ');

        if (profile.shippingName) setCustomerName(profile.shippingName);
        if (profile.email) setCustomerEmail(profile.email);
        if (fullAddress) setShippingAddress(fullAddress);
        setIsInternational(Boolean(profile.isInternational));
        if (profile.shippingName || fullAddress) {
          setProfilePrefilled(true);
          setStatus('Shipping details pre-filled from profile');
        }
      } catch {
        // Optional enhancement; ignore errors.
      }
    })();
  }, []);

  useEffect(() => {
    if (!directItems.length) {
      setShippingOptions([]);
      setSelectedShippingMethodId(null);
      return;
    }

    let canceled = false;
    void (async () => {
      setIsLoadingShipping(true);
      try {
        const response = await getShippingOptions({
          subtotalUsd: Number(directSubtotal.toFixed(2)),
          isInternational,
        });
        if (canceled) return;
        setShippingOptions(response.availableMethods);
        setSelectedShippingMethodId((previous) => {
          const isCurrentValid = response.availableMethods.some((m) => m.id === previous);
          return isCurrentValid ? previous : response.requiredMethod.id;
        });
      } catch (error) {
        if (!canceled) {
          setStatus(error instanceof Error ? error.message : 'Failed to load shipping options');
        }
      } finally {
        if (!canceled) setIsLoadingShipping(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [directItems.length, directSubtotal, isInternational]);

  async function resolveWalletAddress(): Promise<string> {
    const session = await loadWalletSession();
    if (!session.walletAddress) {
      throw new Error('Open Wallet (top-right), connect, then sign in before paying.');
    }
    return session.walletAddress;
  }

  async function clearPostCheckoutState(): Promise<void> {
    const token = await getAuthToken();
    if (token) {
      await clearRemoteCart();
    }
    await Promise.all([clearPendingDirectCheckout(), clearCart()]);
    setCartItems([]);
  }

  async function removeDirectItem(itemId: string): Promise<void> {
    const next = cartItems.filter((item) => item.id !== itemId);
    await persistCart(next);
    setStatus('Item removed from cart');
  }

  async function maybeSaveProfile(): Promise<void> {
    if (!saveShippingForLater) return;
    const token = await getAuthToken();
    if (!token) {
      setStatus('Connect/sign-in from Wallet to save shipping details.');
      return;
    }

    const parsed = parseAddress(shippingAddress);
    setIsSavingProfile(true);
    try {
      await updateUserProfile({
        email: customerEmail,
        shippingName: customerName,
        shippingAddress: parsed.shippingAddress,
        shippingCity: parsed.shippingCity,
        shippingState: parsed.shippingState,
        shippingZip: parsed.shippingZip,
        shippingCountry: 'US',
        isInternational,
      });
      setStatus('Shipping profile saved');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save shipping profile');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function finalizePendingOrder(pending: PendingDirectCheckout): Promise<void> {
    const confirmed = await confirmDirectCheckout({
      orderId: pending.orderId,
      txSignature: pending.txSignature,
    });

    await clearPostCheckoutState();
    setSuccessSummary({
      orderId: pending.orderId,
      txSignature: confirmed.txSignature || pending.txSignature,
      pointsAwarded: confirmed.pointsAwarded,
      newBalance: confirmed.newBalance,
    });
    setStatus(`Order confirmed. +${confirmed.pointsAwarded} points`);
    setStep('cart');
  }

  useEffect(() => {
    void (async () => {
      const pending = await loadPendingDirectCheckout();
      if (!pending) return;
      setStatus('Finalizing previous checkout...');
      try {
        await finalizePendingOrder(pending);
      } catch (error) {
        setStatus(error instanceof Error ? `Unable to finalize previous checkout: ${error.message}` : 'Unable to finalize previous checkout');
      }
    })();
  }, []);

  async function handleProceedToPayment(): Promise<void> {
    if (!customerName.trim() || !customerEmail.trim() || !shippingAddress.trim()) {
      setStatus('Fill in all shipping details before continuing');
      return;
    }
    if (!selectedShippingMethod) {
      setStatus('Select a shipping method to continue');
      return;
    }
    await maybeSaveProfile();
    setStep('payment');
  }

  async function handlePayment(): Promise<void> {
    setIsSubmitting(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Open Wallet (top-right), connect, and sign in first.');
      }

      const walletAddress = await resolveWalletAddress();
      const latestCart = await loadCart();
      setCartItems(latestCart);

      const directOnly = latestCart.filter((item) => item.source === 'direct');
      if (!directOnly.length) {
        throw new Error('Direct cart is empty. Return to shop and add items.');
      }
      if (!selectedShippingMethod) {
        throw new Error('Shipping method missing. Return to details step.');
      }

      setStatus('Creating order...');
      const createResult = await createDirectCheckout({
        items: directOnly.map((item) => ({ id: item.id, quantity: item.quantity })),
        customerName,
        customerEmail,
        shippingAddress,
        isInternational,
        shippingMethodId: selectedShippingMethod.id,
        currency: 'SOL',
      });

      if (!createResult.expectedLamports) {
        throw new Error('Server did not return expected SOL lamports');
      }

      setStatus('Building transaction...');
      const tx = await buildSolDirectCheckoutTransaction({
        rpcEndpoint: env.rpcEndpoint,
        payerWallet: walletAddress,
        merchantWallet: createResult.merchantWallet,
        memo: createResult.memo,
        expectedLamports: createResult.expectedLamports,
      });

      setStatus('Requesting wallet signature...');
      const { signAndSendTransaction } = await import('../../lib/wallet/mwa');
      const signature = await signAndSendTransaction(tx, walletAddress);
      const pending: PendingDirectCheckout = {
        orderId: createResult.orderId,
        txSignature: signature,
      };

      await savePendingDirectCheckout(pending);
      setStatus('Transaction sent. Confirming order...');
      await finalizePendingOrder(pending);
    } catch (error) {
      try {
        await syncCartFromRemote();
      } catch {
        // Preserve current local cart state when sync fails.
      }
      setStatus(error instanceof Error ? error.message : 'Checkout failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  const canGoToCart = step !== 'cart';
  const canGoToDetails = step === 'payment';

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text style={styles.title}>CHECKOUT</Text>

        <View style={styles.stepRow}>
          <Pressable onPress={() => canGoToCart && setStep('cart')} disabled={!canGoToCart}>
            <Text style={[styles.stepLabel, step === 'cart' ? styles.stepLabelActive : null]}>1. CART</Text>
          </Pressable>
          <Text style={styles.stepSlash}>/</Text>
          <Pressable onPress={() => canGoToDetails && setStep('details')} disabled={!canGoToDetails}>
            <Text
              style={[
                styles.stepLabel,
                step === 'details' ? styles.stepLabelActive : null,
                !canGoToDetails && step !== 'details' ? styles.stepLabelDisabled : null,
              ]}
            >
              2. DETAILS
            </Text>
          </Pressable>
          <Text style={styles.stepSlash}>/</Text>
          <Text style={[styles.stepLabel, step === 'payment' ? styles.stepLabelActive : styles.stepLabelDisabled]}>
            3. PAYMENT
          </Text>
        </View>

        {successSummary ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Payment Confirmed</Text>
            <Text style={styles.successText}>Order: {successSummary.orderId}</Text>
            <Text style={styles.successText}>Tx: {successSummary.txSignature.slice(0, 14)}...</Text>
            <Text style={styles.successText}>
              +{successSummary.pointsAwarded} points (Balance: {successSummary.newBalance})
            </Text>
          </View>
        ) : null}

        {amazonItemsCount > 0 ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>
              {amazonItemsCount} Amazon item(s) are excluded in this direct checkout flow.
            </Text>
          </View>
        ) : null}

        {step === 'cart' ? (
          <View style={styles.sectionCard}>
            {directItems.length ? (
              directItems.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemTextWrap}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      Qty {item.quantity} • {formatPriceLabel(item.price)}
                    </Text>
                  </View>
                  <Pressable style={styles.removeButton} onPress={() => void removeDirectItem(item.id)}>
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Your direct cart is empty.</Text>
                <Pressable style={styles.returnButton} onPress={() => navigation.navigate('Shop')}>
                  <Text style={styles.returnButtonText}>Return to Shop</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.totalsRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>${directSubtotal.toFixed(2)}</Text>
            </View>

            <Pressable
              style={[styles.primaryButton, directItems.length === 0 ? styles.buttonDisabled : null]}
              disabled={directItems.length === 0}
              onPress={() => setStep('details')}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'details' ? (
          <View style={styles.detailsSection}>
            {profilePrefilled ? <Text style={styles.prefillNote}>Pre-filled from saved profile</Text> : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>FULL NAME</Text>
              <TextInput
                style={styles.fieldInput}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="John Doe"
                placeholderTextColor={tokens.colors.textTertiary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.fieldInput}
                value={customerEmail}
                onChangeText={setCustomerEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="john@example.com"
                placeholderTextColor={tokens.colors.textTertiary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SHIPPING ADDRESS</Text>
              <TextInput
                style={[styles.fieldInput, styles.addressInput]}
                value={shippingAddress}
                onChangeText={setShippingAddress}
                placeholder="123 Gold St, New York, NY 10001"
                placeholderTextColor={tokens.colors.textTertiary}
                multiline
              />
            </View>

            <Pressable style={styles.checkboxRow} onPress={() => setIsInternational((v) => !v)}>
              <View style={[styles.checkbox, isInternational ? styles.checkboxChecked : null]}>
                {isInternational ? <View style={styles.checkboxDot} /> : null}
              </View>
              <Text style={styles.checkboxText}>International Shipping</Text>
            </Pressable>

            {hasAuthToken ? (
              <Pressable style={styles.infoRow} onPress={() => setSaveShippingForLater((v) => !v)}>
                <View style={[styles.checkbox, saveShippingForLater ? styles.checkboxChecked : null]}>
                  {saveShippingForLater ? <View style={styles.checkboxDot} /> : null}
                </View>
                <Text style={styles.infoText}>Save shipping info for future orders</Text>
              </Pressable>
            ) : (
              <View style={styles.infoRowStatic}>
                <Text style={styles.infoIcon}>i</Text>
                <Text style={styles.infoText}>Connect wallet to save shipping info for future orders</Text>
              </View>
            )}

            <View style={styles.shippingPanel}>
              <Text style={styles.shippingPanelTitle}>SHIPPING METHOD</Text>
              {isLoadingShipping ? <Text style={styles.meta}>Loading shipping options...</Text> : null}
              {!isLoadingShipping && shippingOptions.length === 0 ? (
                <Text style={styles.meta}>No shipping options available yet.</Text>
              ) : null}

              {shippingOptions.map((method) => {
                const active = selectedShippingMethodId === method.id;
                return (
                  <Pressable
                    key={method.id}
                    style={styles.shippingOptionRow}
                    onPress={() => setSelectedShippingMethodId(method.id)}
                  >
                    <View style={styles.shippingOptionLeft}>
                      <View style={[styles.radioOuter, active ? styles.radioOuterActive : null]}>
                        {active ? <View style={styles.radioInner} /> : null}
                      </View>
                      <View style={styles.shippingCopy}>
                        <Text style={styles.shippingName}>{method.name}</Text>
                        <Text style={styles.shippingMeta}>
                          Insurance: ${method.insurance.toLocaleString()}
                          {method.requiresSignature ? ' • Signature Required' : ''}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.shippingPrice}>${method.cost.toFixed(2)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryButton} onPress={() => setStep('cart')}>
                <Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, isSavingProfile ? styles.buttonDisabled : null]}
                disabled={isSavingProfile}
                onPress={() => void handleProceedToPayment()}
              >
                <Text style={styles.primaryButtonText}>{isSavingProfile ? 'Saving...' : 'Continue'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {step === 'payment' ? (
          <View style={styles.sectionCard}>
            <Text style={styles.paymentTitle}>Complete Payment</Text>
            <View style={styles.totalsRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>${directSubtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalLabel}>Shipping</Text>
              <Text style={styles.totalValue}>${shippingCost.toFixed(2)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.paymentTotalLabel}>Total (SOL)</Text>
              <Text style={styles.paymentTotalValue}>${orderTotal.toFixed(2)}</Text>
            </View>

            <Text style={styles.meta}>Wallet connection and sign-in are required.</Text>

            <Pressable
              style={[styles.primaryButton, isSubmitting ? styles.buttonDisabled : null]}
              disabled={isSubmitting}
              onPress={() => void handlePayment()}
            >
              <Text style={styles.primaryButtonText}>{isSubmitting ? 'Processing...' : 'Pay With Wallet (SOL)'}</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={() => setStep('details')}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.status}>{status}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: 40,
    paddingBottom: 44,
    gap: tokens.spacing.lg,
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    marginBottom: tokens.spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: tokens.spacing.md,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  stepLabelActive: {
    color: '#c9a84c',
  },
  stepLabelDisabled: {
    color: '#374151',
  },
  stepSlash: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  successCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  successTitle: { fontSize: 16, fontWeight: '800', color: '#10b981' },
  successText: { fontSize: 13, color: 'rgba(16, 185, 129, 0.8)' },
  noticeCard: {
    borderColor: 'rgba(201, 168, 76, 0.3)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    backgroundColor: 'rgba(201, 168, 76, 0.1)',
  },
  noticeText: {
    color: '#c9a84c',
    fontSize: 13,
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 32,
    padding: 24,
    gap: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 8,
  },
  itemTextWrap: { flex: 1 },
  itemName: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  itemMeta: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
    fontWeight: '600',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  removeButtonText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 16,
  },
  emptyTitle: {
    color: '#9ca3af',
    fontSize: 15,
  },
  returnButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  returnButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalLabel: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  totalValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  detailsSection: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 32,
    padding: 24,
    gap: 20,
  },
  prefillNote: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '700',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    textAlign: 'center',
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#6b7280',
    paddingLeft: 4,
  },
  fieldInput: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  addressInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4b5563',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  checkboxChecked: {
    borderColor: '#c9a84c',
    backgroundColor: 'rgba(201, 168, 76, 0.1)',
  },
  checkboxDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
    backgroundColor: '#c9a84c',
  },
  checkboxText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  infoRowStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 16,
    borderRadius: 20,
  },
  infoIcon: {
    color: '#3b82f6',
    fontWeight: '800',
    width: 20,
    textAlign: 'center',
  },
  infoText: {
    flex: 1,
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 20,
  },
  shippingPanel: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  shippingPanelTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#6b7280',
  },
  shippingOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: 16,
  },
  shippingOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#4b5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#c9a84c',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#c9a84c',
  },
  shippingCopy: {
    flex: 1,
    gap: 4,
  },
  shippingName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  shippingMeta: {
    color: '#9ca3af',
    fontSize: 12,
  },
  shippingPrice: {
    color: '#c9a84c',
    fontSize: 16,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#c9a84c',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#0a0a0a',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  paymentTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  paymentTotalLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  paymentTotalValue: {
    color: '#c9a84c',
    fontSize: 24,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  meta: {
    fontSize: 12,
    color: '#9ca3af',
  },
  status: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 16,
    marginBottom: 40,
  },
});
