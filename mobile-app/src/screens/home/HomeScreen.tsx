import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { getPortfolioSummary } from '../../lib/portfolio/summary-client';
import { PortfolioSummaryResponse } from '../../lib/api/types';
import type { MainTabParamList } from '../../navigation';
import { tokens } from '../../theme/tokens';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

const EMPTY_SUMMARY: PortfolioSummaryResponse = {
  success: true,
  walletAddress: '',
  w3bBalance: 0,
  goldbackRateUsd: 0,
  portfolioUsd: 0,
  loyaltyPoints: 0,
  lastUpdated: '',
  dataHealth: {
    w3bSource: 'fallback',
    loyaltySource: 'fallback',
  },
};

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}

export function HomeScreen({ navigation }: Props) {
  const [summary, setSummary] = useState<PortfolioSummaryResponse>(EMPTY_SUMMARY);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Connect wallet to view live balances.');

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setIsLoading(true);

      void (async () => {
        try {
          const response = await getPortfolioSummary();
          if (!mounted) return;
          setSummary(response);
          setIsAuthenticated(true);
          setStatus('Portfolio synced');
        } catch (error) {
          if (!mounted) return;
          const message = error instanceof Error ? error.message : 'Portfolio unavailable';
          const unauth = /(auth|token|401|required)/i.test(message);
          if (unauth) {
            setSummary(EMPTY_SUMMARY);
            setIsAuthenticated(false);
            setStatus('Connect wallet to view live balances.');
          } else {
            setStatus(message);
          }
        } finally {
          if (mounted) {
            setIsLoading(false);
          }
        }
      })();

      return () => {
        mounted = false;
      };
    }, [])
  );

  const portfolioUsdLabel = useMemo(() => formatUsd(summary.portfolioUsd), [summary.portfolioUsd]);
  const rateLabel = useMemo(() => `$${summary.goldbackRateUsd.toFixed(2)}/GB`, [summary.goldbackRateUsd]);
  const updatedLabel = useMemo(() => {
    if (!summary.lastUpdated) return '—';
    return new Date(summary.lastUpdated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }, [summary.lastUpdated]);

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.headerRow}>
        <Text style={styles.welcome}>Welcome</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{isAuthenticated ? 'LIVE' : 'OFF'}</Text>
        </View>
      </View>

      <View style={styles.portfolioCard}>
        <View style={styles.portfolioHead}>
          <Text style={styles.portfolioLabel}>Portfolio</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{summary.loyaltyPoints} pts</Text>
          </View>
        </View>

        <Text style={styles.portfolioAmount}>{portfolioUsdLabel}</Text>
        <Text style={styles.portfolioSubline}>
          {summary.w3bBalance} W3B • Rate {rateLabel}
        </Text>
        <Text style={styles.portfolioMeta}>Updated {updatedLabel}</Text>

        <Pressable style={styles.portfolioButton} onPress={() => navigation.navigate('Web3', { screen: 'Dashboard' })}>
          <Text style={styles.portfolioButtonText}>Portfolio</Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionButton, styles.actionButtonDark]}
          onPress={() => navigation.navigate('Web3', { screen: 'Redeem' })}
        >
          <Text style={styles.actionButtonText}>Withdraw</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.actionButtonGold]} onPress={() => navigation.navigate('Shop')}>
          <Text style={[styles.actionButtonText, styles.actionButtonTextDark]}>Buy Gold</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Do more with GoldBack.</Text>
        <Text style={styles.sectionSubtitle}>Make your gold work for you.</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.featureCard}>
          <Image source={require('../../../assets/landing/blackwebtokenlogo.png')} style={styles.featureIcon} />
          <Text style={styles.featureTitle}>Stake W3B</Text>
          <Text style={styles.featureMeta}>Earn 3-4% APY</Text>
        </View>

        <View style={styles.featureCard}>
          <Image source={require('../../../assets/landing/goldback.png')} style={styles.featureIcon} />
          <Text style={styles.featureTitle}>Physical Gold</Text>
          <Text style={styles.featureMeta}>Buy from Shop</Text>
        </View>

        <View style={[styles.featureCard, styles.featureCardWide]}>
          <Image source={require('../../../assets/landing/blackweblogo_v3.png')} style={styles.featureIcon} />
          <Text style={styles.featureTitle}>Withdraw Gold</Text>
          <Text style={styles.featureMeta}>Redemption flow</Text>
        </View>
      </View>

      <Text style={styles.status}>
        {isLoading ? 'Refreshing portfolio...' : status}
      </Text>
      {!isAuthenticated ? <Text style={styles.authHint}>Open Wallet (top-right) to connect and sign in.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.lg,
    paddingBottom: 40,
    gap: tokens.spacing.lg,
    backgroundColor: tokens.colors.bgBase,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  welcome: {
    fontSize: 34,
    lineHeight: 40,
    color: tokens.colors.textPrimary,
    fontWeight: '600',
  },
  headerBadge: {
    backgroundColor: tokens.colors.accentGold,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerBadgeText: {
    color: '#0a0a0a',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  portfolioCard: {
    backgroundColor: tokens.colors.bgElevated,
    borderRadius: 0,
    padding: 18,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
  },
  portfolioHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  portfolioLabel: {
    color: tokens.colors.textPrimary,
    fontSize: 19,
    fontWeight: '600',
  },
  pill: {
    backgroundColor: tokens.colors.bgMuted,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
  },
  pillText: {
    color: tokens.colors.accentGold,
    fontSize: 11,
    fontWeight: '600',
  },
  portfolioAmount: {
    marginTop: 16,
    color: tokens.colors.textPrimary,
    fontSize: 42,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  portfolioSubline: {
    marginTop: 8,
    color: tokens.colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  portfolioMeta: {
    marginTop: 4,
    color: tokens.colors.textTertiary,
    fontSize: 12,
  },
  portfolioButton: {
    marginTop: 20,
    backgroundColor: tokens.colors.accentGold,
    borderRadius: 0,
    paddingVertical: 12,
    alignItems: 'center',
  },
  portfolioButtonText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionButtonDark: {
    backgroundColor: tokens.colors.bgElevated,
    borderColor: tokens.colors.hairline,
  },
  actionButtonGold: {
    backgroundColor: tokens.colors.accentGold,
    borderColor: tokens.colors.accentGold,
  },
  actionButtonText: {
    color: tokens.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
  },
  actionButtonTextDark: {
    color: '#0a0a0a',
  },
  sectionHeader: {
    gap: 4,
    marginTop: 2,
  },
  sectionTitle: {
    color: tokens.colors.textPrimary,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '600',
  },
  sectionSubtitle: {
    color: tokens.colors.textSecondary,
    fontSize: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  featureCard: {
    width: '48.3%',
    backgroundColor: tokens.colors.bgElevated,
    borderRadius: 0,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 184,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
  },
  featureCardWide: {
    width: '100%',
    minHeight: 160,
  },
  featureIcon: {
    width: 78,
    height: 78,
    resizeMode: 'contain',
    marginTop: 6,
  },
  featureTitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 0,
  },
  featureMeta: {
    marginTop: 6,
    fontSize: 13,
    color: tokens.colors.textTertiary,
    textAlign: 'center',
  },
  status: {
    marginTop: 2,
    color: tokens.colors.textSecondary,
    fontSize: 12,
  },
  authHint: {
    color: tokens.colors.accentGold,
    fontSize: 12,
    fontWeight: '600',
  },
});
