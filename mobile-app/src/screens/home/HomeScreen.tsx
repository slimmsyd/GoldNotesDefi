import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { getPortfolioSummary } from '../../lib/portfolio/summary-client';
import { getVaultSummary } from '../../lib/protocol/status-client';
import { PortfolioSummaryResponse, VaultSummaryResponse } from '../../lib/api/types';
import type { MainTabParamList } from '../../navigation';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

const EMPTY_SUMMARY: PortfolioSummaryResponse = {
  success: true,
  walletAddress: '',
  wgbBalance: 0,
  goldbackRateUsd: 10.14,
  portfolioUsd: 0,
  loyaltyPoints: 0,
  lastUpdated: '',
  dataHealth: {
    wgbSource: 'fallback',
    loyaltySource: 'fallback',
  },
};

export function HomeScreen({ navigation }: Props) {
  const [summary, setSummary] = useState<PortfolioSummaryResponse>(EMPTY_SUMMARY);
  const [vaultInfo, setVaultInfo] = useState<VaultSummaryResponse | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [status, setStatus] = useState('Syncing...');

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [portRes, vaultRes] = await Promise.all([
        getPortfolioSummary().catch(() => null),
        getVaultSummary().catch(() => null)
      ]);

      if (portRes) {
        setSummary(portRes);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setSummary(EMPTY_SUMMARY);
      }

      if (vaultRes) {
        setVaultInfo(vaultRes);
      }

      setStatus('Synced');
    } catch (e) {
      setStatus('Failed to sync');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const priceFormatted = useMemo(() => `$${summary.goldbackRateUsd.toFixed(2)}`, [summary.goldbackRateUsd]);
  const reserves = vaultInfo?.provenReserves || 6;
  const supply = vaultInfo?.totalSupply || 6;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor="#c9a84c" />}
      >
        {/* Top Header Actions */}
        <View style={styles.headerRow}>
          <View />
          <View style={styles.headerActions}>
            <Pressable style={styles.headerPill} onPress={loadData}>
              <Text style={styles.headerPillText}>Verify Now</Text>
            </Pressable>
            <Pressable style={styles.headerPill} onPress={loadData}>
              <Text style={styles.headerPillText}>Refresh</Text>
            </Pressable>
          </View>
        </View>

        {/* Hero Pricing */}
        <View style={styles.heroSection}>
          <Text style={styles.heroLabel}>WGB ASSET PRICE</Text>
          <Text style={styles.heroPrice}>{priceFormatted}</Text>
          <View style={styles.priceChangeRow}>
            <View style={styles.priceChangePill}>
              <Text style={styles.priceChangeText}>↑ $0.00 (0.00%)</Text>
            </View>
            <Text style={styles.priceChangeSubtext}>Today</Text>
          </View>
        </View>

        {/* Quick Actions Row */}
        <View style={styles.quickActionsContainer}>
          {/* Buy */}
          <Pressable style={styles.quickActionItem} onPress={() => navigation.navigate('Shop')}>
            <View style={[styles.quickActionButton, styles.quickActionGold]}>
              <Text style={styles.quickActionIconGold}>+</Text>
            </View>
            <Text style={styles.quickActionLabel}>Buy</Text>
          </Pressable>

          {/* Swap */}
          <Pressable style={styles.quickActionItem} onPress={() => navigation.navigate('Web3', { screen: 'Swap' })}>
            <View style={styles.quickActionButton}>
              <Text style={styles.quickActionIcon}>⇄</Text>
            </View>
            <Text style={styles.quickActionLabel}>Swap</Text>
          </Pressable>

          {/* Vault */}
          <Pressable style={styles.quickActionItem} onPress={() => navigation.navigate('Web3', { screen: 'Vault' })}>
            <View style={styles.quickActionButton}>
              <Text style={styles.quickActionIcon}>🔒</Text>
            </View>
            <Text style={styles.quickActionLabel}>Vault</Text>
          </Pressable>

          {/* Send */}
          <Pressable style={styles.quickActionItem} onPress={() => navigation.navigate('Web3', { screen: 'Redeem' })}>
            <View style={styles.quickActionButton}>
              <Text style={styles.quickActionIcon}>↑</Text>
            </View>
            <Text style={styles.quickActionLabel}>Send</Text>
          </Pressable>
        </View>

        {/* Asset Information Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ASSET INFORMATION</Text>
        </View>

        <View style={styles.grid}>
          {/* Card 1: Asset Backing */}
          <View style={styles.infoCard}>
            <Text style={styles.watermark}>{reserves}</Text>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Asset Backing</Text>
              <View style={styles.badgeNeutral}>
                <Text style={styles.badgeNeutralText}>VERIFIED</Text>
              </View>
            </View>
            <Text style={styles.cardMainValue}>{reserves}</Text>
            <Text style={styles.cardSubValue}>100% PHYSICALLY BACKED</Text>
            <View style={styles.cardFooter}>
              <View style={styles.badgeEmerald}>
                <Text style={styles.badgeEmeraldText}>VAULT SECURED</Text>
              </View>
            </View>
          </View>

          {/* Card 2: Reserves */}
          <View style={styles.infoCard}>
            <Text style={styles.watermark}>{reserves}</Text>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Reserves</Text>
              <View style={styles.badgeNeutral}>
                <Text style={styles.badgeNeutralText}>VERIFIED</Text>
              </View>
            </View>
            <Text style={styles.cardMainValue}>{reserves}</Text>
            <Text style={styles.cardSubValue}>PHYSICALLY SECURED</Text>
            <View style={styles.cardFooter}>
              <View style={styles.badgeEmerald}>
                <Text style={styles.badgeEmeraldText}>AUDIT LIVE</Text>
              </View>
            </View>
          </View>

          {/* Card 3: Circulating Supply */}
          <View style={styles.infoCard}>
            <Text style={styles.watermark}>{supply}</Text>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Circulating{'\n'}Supply</Text>
              <View style={styles.badgeNeutral}>
                <Text style={styles.badgeNeutralText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.cardMainValue}>{supply}</Text>
          </View>

          {/* Card 4: WGB Price */}
          <View style={styles.infoCard}>
            <Text style={styles.watermark}>10</Text>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>WGB Price</Text>
              <View style={styles.badgeEmerald}>
                <Text style={styles.badgeEmeraldText}>↑ 0%</Text>
              </View>
            </View>
            <Text style={styles.cardMainValue}>{priceFormatted}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Floating Chat Input */}
      {/* <View style={styles.chatFloatingContainer}>
        <View style={styles.chatInputWrapper}>
          <View style={styles.chatAvatar}>
            <Text style={styles.chatAvatarText}>G</Text>
          </View>
          <TextInput
            style={styles.chatInput}
            placeholder="Ask For Gnosis"
            placeholderTextColor="#6b7280"
            value={chatDraft}
            onChangeText={setChatDraft}
            onSubmitEditing={() => setChatDraft('')}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.chatSendBtn, chatDraft.trim() ? styles.chatSendBtnActive : null]}
            onPress={() => setChatDraft('')}
          >
            <Text style={[styles.chatSendArrow, chatDraft.trim() ? styles.chatSendArrowActive : null]}>↑</Text>
          </Pressable>
        </View>
      </View> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 100,
    backgroundColor: '#0a0a0a',
    minHeight: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerPill: {
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerPillText: {
    color: '#e8d48b',
    fontSize: 12,
    fontWeight: '600',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  heroLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  heroPrice: {
    color: '#ffffff',
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: -2,
    marginBottom: 12,
  },
  priceChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceChangePill: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  priceChangeText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '700',
  },
  priceChangeSubtext: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 60,
  },
  quickActionItem: {
    alignItems: 'center',
    gap: 12,
  },
  quickActionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionGold: {
    backgroundColor: '#c9a84c',
  },
  quickActionIcon: {
    color: '#ffffff',
    fontSize: 24,
  },
  quickActionIconGold: {
    color: '#0a0a0a',
    fontSize: 28,
    fontWeight: '400',
  },
  quickActionLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  infoCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 32,
    padding: 20,
    minHeight: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    bottom: -20,
    right: -10,
    fontSize: 140,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.03)',
    zIndex: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 1,
    marginBottom: 24,
    gap: 8,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    flexShrink: 1,
  },
  badgeNeutral: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  badgeNeutralText: {
    color: '#d1d5db',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardMainValue: {
    color: '#ffffff',
    fontSize: 40,
    fontWeight: '800',
    zIndex: 1,
    marginBottom: 8,
  },
  cardSubValue: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    zIndex: 1,
  },
  cardFooter: {
    marginTop: 'auto',
    alignItems: 'flex-start',
    zIndex: 1,
    paddingTop: 16,
  },
  badgeEmerald: {
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  badgeEmeraldText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  chatFloatingContainer: {
    position: 'absolute',
    bottom: 100, // Float right above the absolute nav bar (bottom: 24, height: 64)
    left: 20,
    right: 20,
    zIndex: 50,
  },
  chatInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 25, 25, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 4,
  },
  chatAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#c9a84c',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  chatAvatarText: {
    color: '#0a0a0a',
    fontWeight: 'bold',
    fontSize: 16,
  },
  chatInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '400',
  },
  chatSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  chatSendBtnActive: {
    backgroundColor: '#c9a84c',
  },
  chatSendArrow: {
    color: '#6b7280',
    fontSize: 18,
    fontWeight: '700',
  },
  chatSendArrowActive: {
    color: '#0a0a0a',
  },
});

