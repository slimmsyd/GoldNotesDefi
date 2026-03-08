import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text } from 'react-native';
import { DashboardScreen } from '../screens/web3/DashboardScreen';
import { SwapScreen } from '../screens/web3/SwapScreen';
import { RedeemScreen } from '../screens/web3/RedeemScreen';
import { VaultScreen } from '../screens/web3/VaultScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { tokens } from '../theme/tokens';

export type Web3StackParamList = {
  Dashboard: undefined;
  Swap: undefined;
  Redeem: undefined;
  Vault: undefined;
  Profile: undefined;
};

interface Web3StackProps {
  onOpenWallet: () => void;
}

const Stack = createNativeStackNavigator<Web3StackParamList>();

function WalletButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.walletButton}>
      <Text style={styles.walletButtonText}>Wallet</Text>
    </Pressable>
  );
}

export function Web3Stack({ onOpenWallet }: Web3StackProps) {
  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: tokens.colors.bgBase },
        headerTitleStyle: { color: tokens.colors.textPrimary, fontWeight: '700' },
        headerTintColor: tokens.colors.textPrimary,
        contentStyle: { backgroundColor: tokens.colors.bgBase },
        headerRight: () => <WalletButton onPress={onOpenWallet} />,
      }}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: '' }} />
      <Stack.Screen name="Swap" component={SwapScreen} options={{ title: 'Swap' }} />
      <Stack.Screen name="Redeem" component={RedeemScreen} options={{ title: 'Redeem' }} />
      <Stack.Screen name="Vault" component={VaultScreen} options={{ title: 'Vault' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  walletButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm - 1,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.bgElevated,
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
    marginRight: 4,
  },
  walletButtonText: {
    color: tokens.colors.accentGold,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
