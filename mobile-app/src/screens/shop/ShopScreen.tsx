import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { getRemoteCart, saveRemoteCart } from '../../lib/auth/auth-client';
import { ShopCatalogItem } from '../../lib/api/types';
import { getShopCatalog } from '../../lib/shop/catalog-client';
import { CartItem, loadCart, saveCart } from '../../state/cart';
import { getAuthToken } from '../../state/auth';
import type { MainTabParamList } from '../../navigation';
import { shadows, tokens } from '../../theme/tokens';

type Props = BottomTabScreenProps<MainTabParamList, 'Shop'>;

interface CatalogState {
  goldbackRate: number;
  rateUpdatedAt: string | null;
  packages: ShopCatalogItem[];
}

interface ShopHeroViewModel {
  title: string;
  subtitle: string;
  rateLabel: string;
  updatedLabel: string;
}

function toCartItem(item: ShopCatalogItem, quantity: number): CartItem {
  return {
    id: item.id,
    name: item.name,
    image: item.imageUrl || item.image || undefined,
    price: item.displayPriceLabel,
    quantity,
    source: 'direct',
  };
}

export function ShopScreen({ navigation }: Props) {
  const [catalog, setCatalog] = useState<CatalogState | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const syncRemoteCartIfAuthorized = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) return;

    try {
      const remote = await getRemoteCart();
      if (remote.cart) {
        await saveCart(remote.cart);
        setCartItems(remote.cart);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Remote cart sync failed';
      setStatus(message);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [catalogResponse, localCart] = await Promise.all([getShopCatalog(), loadCart()]);
        setCatalog({
          goldbackRate: catalogResponse.goldbackRate,
          rateUpdatedAt: catalogResponse.rateUpdatedAt,
          packages: catalogResponse.packages,
        });
        setCartItems(localCart);
        setStatus('');
        await syncRemoteCartIfAuthorized();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Failed to load shop');
      }
    })();
  }, [syncRemoteCartIfAuthorized]);

  const directItems = useMemo(() => cartItems.filter((item) => item.source === 'direct'), [cartItems]);
  const directCount = useMemo(
    () => directItems.reduce((count, item) => count + item.quantity, 0),
    [directItems]
  );
  const directSubtotal = useMemo(
    () =>
      directItems.reduce((sum, item) => {
        const unit = parseFloat(item.price.replace(/[^0-9.]/g, ''));
        return sum + (Number.isFinite(unit) ? unit : 0) * item.quantity;
      }, 0),
    [directItems]
  );

  const heroViewModel = useMemo<ShopHeroViewModel>(() => {
    const rateLabel = catalog?.goldbackRate ? `$${catalog.goldbackRate.toFixed(2)}/GB` : '--';
    const updatedLabel = catalog?.rateUpdatedAt
      ? new Date(catalog.rateUpdatedAt).toLocaleDateString()
      : '—';

    return {
      title: 'The Gold Collection',
      subtitle: 'Physical GoldBack notes with wallet-native mobile checkout.',
      rateLabel,
      updatedLabel,
    };
  }, [catalog]);

  async function persistCart(items: CartItem[]): Promise<void> {
    await saveCart(items);
    const token = await getAuthToken();
    if (token) {
      await saveRemoteCart(items);
    }
  }

  async function handleAddToCart(pkg: ShopCatalogItem): Promise<void> {
    setBusyId(pkg.id);
    try {
      const existing = cartItems.find((item) => item.id === pkg.id);
      const increment = existing ? 1 : Math.max(pkg.minQty || 1, 1);
      const nextQuantity = (existing?.quantity || 0) + increment;

      if (nextQuantity > pkg.stock) {
        throw new Error(`Cannot add ${pkg.name}. Stock limit reached (${pkg.stock}).`);
      }

      const nextItems = existing
        ? cartItems.map((item) => (item.id === pkg.id ? { ...item, quantity: nextQuantity } : item))
        : [...cartItems, toCartItem(pkg, increment)];

      setCartItems(nextItems);
      await persistCart(nextItems);
      setStatus(`Added ${pkg.name} to cart`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to add to cart');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.page}>
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>GoldBack Mobile</Text>
          <Text style={styles.heroTitle}>{heroViewModel.title}</Text>
          <Text style={styles.heroBody}>{heroViewModel.subtitle}</Text>
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMetaValue}>Rate {heroViewModel.rateLabel}</Text>
            <Text style={styles.heroMetaDivider}>•</Text>
            <Text style={styles.heroMetaLabel}>Updated {heroViewModel.updatedLabel}</Text>
          </View>
        </View>

        {catalog?.packages.length ? (
          catalog.packages.map((pkg) => {
            const resolvedImageUrl =
              pkg.imageUrl || (pkg.image && /^https?:\/\//.test(pkg.image) ? pkg.image : null);

            return (
              <View key={pkg.id} style={styles.card}>
                <View style={styles.imageFrame}>
                  {resolvedImageUrl ? (
                    <Image source={{ uri: resolvedImageUrl }} style={styles.cardImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Text style={styles.imagePlaceholderText}>No preview available</Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardTopRow}>
                  <Text style={styles.cardName}>{pkg.name}</Text>
                  <Text style={styles.cardPrice}>{pkg.displayPriceLabel}</Text>
                </View>

                <Text style={styles.cardStock}>Stock {pkg.stock} • Minimum {pkg.minQty}</Text>
                <Text style={styles.cardDescription}>{pkg.description}</Text>
                <Text style={styles.cardFeatures}>{pkg.features.join(' • ')}</Text>

                <Pressable
                  style={[styles.addButton, busyId === pkg.id ? styles.disabled : null]}
                  disabled={busyId === pkg.id}
                  onPress={() => void handleAddToCart(pkg)}
                >
                  <Text style={styles.addButtonText}>
                    {busyId === pkg.id ? 'Adding...' : 'Add to Cart'}
                  </Text>
                </Pressable>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No products available</Text>
            <Text style={styles.emptyBody}>Catalog will appear here once inventory is published.</Text>
          </View>
        )}

        {status ? <Text style={styles.status}>{status}</Text> : null}
      </ScrollView>

      <View style={styles.cartSummary}>
        <View style={styles.summaryTextWrap}>
          <Text style={styles.summaryLabel}>Direct Cart</Text>
          <Text style={styles.summaryValue}>
            {directCount} items • ${directSubtotal.toFixed(2)}
          </Text>
        </View>
        <Pressable
          style={[styles.checkoutButton, directCount === 0 ? styles.disabled : null]}
          disabled={directCount === 0}
          onPress={() => navigation.navigate('Checkout')}
        >
          <Text style={styles.checkoutButtonText}>Go to Checkout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colors.bgBase },
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    paddingBottom: 128,
    gap: tokens.spacing.lg,
  },
  hero: {
    backgroundColor: tokens.colors.bgElevated,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    padding: tokens.spacing.xl,
    gap: tokens.spacing.sm,
    ...shadows.soft,
  },
  heroKicker: {
    color: tokens.colors.textTertiary,
    fontSize: tokens.typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.title,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroBody: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.body,
    lineHeight: 21,
    marginTop: 2,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  heroMetaValue: {
    color: tokens.colors.accentGold,
    fontWeight: '800',
    fontSize: 14,
  },
  heroMetaDivider: {
    color: tokens.colors.textTertiary,
    fontSize: 12,
  },
  heroMetaLabel: {
    color: tokens.colors.textTertiary,
    fontSize: 12,
  },
  card: {
    backgroundColor: tokens.colors.bgElevated,
    borderRadius: 0,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    gap: tokens.spacing.sm,
    ...shadows.soft,
  },
  imageFrame: {
    width: '100%',
    height: 204,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: tokens.colors.bgMuted,
    marginBottom: 4,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: tokens.typography.caption,
    color: tokens.colors.textTertiary,
    fontWeight: '600',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.md,
  },
  cardName: {
    flex: 1,
    fontSize: tokens.typography.subtitle,
    fontWeight: '800',
    color: tokens.colors.textPrimary,
  },
  cardPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: tokens.colors.accentGold,
    fontVariant: ['tabular-nums'],
  },
  cardStock: {
    fontSize: 12,
    color: tokens.colors.textTertiary,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: tokens.typography.body,
    color: tokens.colors.textSecondary,
    lineHeight: 22,
  },
  cardFeatures: {
    fontSize: 12,
    color: tokens.colors.textTertiary,
    lineHeight: 18,
  },
  addButton: {
    marginTop: tokens.spacing.sm,
    backgroundColor: tokens.colors.accentGold,
    borderRadius: 0,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonText: { color: '#0a0a0a', fontWeight: '700', fontSize: 14, letterSpacing: 0.2 },
  emptyState: {
    backgroundColor: tokens.colors.bgElevated,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    borderRadius: 0,
    padding: tokens.spacing.xl,
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  emptyTitle: { color: tokens.colors.textPrimary, fontWeight: '700', fontSize: 16 },
  emptyBody: { color: tokens.colors.textTertiary, fontSize: 13, textAlign: 'center' },
  status: {
    marginTop: 2,
    fontSize: 12,
    color: tokens.colors.textSecondary,
  },
  cartSummary: {
    position: 'absolute',
    left: tokens.spacing.md,
    right: tokens.spacing.md,
    bottom: tokens.spacing.md,
    backgroundColor: '#1a1a1ae0',
    borderRadius: 0,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadows.floating,
  },
  summaryTextWrap: {
    paddingRight: tokens.spacing.md,
    flex: 1,
  },
  summaryLabel: { color: tokens.colors.textTertiary, fontSize: 12 },
  summaryValue: { color: tokens.colors.textPrimary, fontWeight: '800', fontSize: 16, marginTop: 2 },
  checkoutButton: {
    backgroundColor: tokens.colors.accentGold,
    borderRadius: 0,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  checkoutButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
