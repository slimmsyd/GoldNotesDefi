import { NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text } from 'react-native';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ShopScreen } from '../screens/shop/ShopScreen';
import { CheckoutScreen } from '../screens/checkout/CheckoutScreen';
import { OrdersScreen } from '../screens/orders/OrdersScreen';
import { Web3Stack, Web3StackParamList } from './Web3Stack';
import { tokens } from '../theme/tokens';

export type MainTabParamList = {
  Home: undefined;
  Shop: undefined;
  Checkout: undefined;
  Web3: NavigatorScreenParams<Web3StackParamList>;
  Orders: undefined;
};

interface MainTabsProps {
  onOpenWallet: () => void;
}

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Simple icon component using Unicode glyphs — no extra dependency needed. */
function TabIcon({ glyph, color, size }: { glyph: string; color: string; size: number }) {
  return <Text style={{ fontSize: size - 2, color, textAlign: 'center' }}>{glyph}</Text>;
}

function WalletButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.walletButton}>
      <Text style={styles.walletButtonText}>Wallet</Text>
    </Pressable>
  );
}

export function MainTabs({ onOpenWallet }: MainTabsProps) {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: tokens.colors.bgBase },
        headerTitleStyle: { color: tokens.colors.textPrimary, fontWeight: '700' },
        headerTintColor: tokens.colors.textPrimary,
        sceneStyle: { backgroundColor: tokens.colors.bgBase },
        tabBarActiveTintColor: tokens.colors.accentGold,
        tabBarInactiveTintColor: tokens.colors.textTertiary,
        tabBarStyle: {
          borderTopColor: tokens.colors.hairline,
          backgroundColor: tokens.colors.bgElevated,
        },
        headerRight: () => <WalletButton onPress={onOpenWallet} />,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'GoldBack',
          tabBarIcon: ({ color, size }) => <TabIcon glyph="⬡" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => <TabIcon glyph="🛒" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{
          title: 'Checkout',
          tabBarIcon: ({ color, size }) => <TabIcon glyph="💳" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Web3"
        options={{
          title: 'Web3',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <TabIcon glyph="⛓" color={color} size={size} />,
        }}
      >
        {() => <Web3Stack onOpenWallet={onOpenWallet} />}
      </Tab.Screen>
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <TabIcon glyph="📋" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
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
