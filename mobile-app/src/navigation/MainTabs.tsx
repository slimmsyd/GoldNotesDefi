import { NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

/** Simple icon component using Unicode glyphs */
function TabIcon({ glyph, color, size, focused }: { glyph: string; color: string; size: number; focused: boolean }) {
  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
      <Text style={{ fontSize: size - 2, color, textAlign: 'center' }}>{glyph}</Text>
    </View>
  );
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
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 24,
          left: 24,
          right: 24,
          elevation: 0,
          backgroundColor: 'rgba(20, 20, 20, 0.95)',
          borderRadius: 32,
          height: 64,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
        },
        headerRight: () => <WalletButton onPress={onOpenWallet} />,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'GoldBack',
          tabBarIcon: ({ color, size, focused }) => <TabIcon glyph="⬡" color={color} size={size} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size, focused }) => <TabIcon glyph="🛒" color={color} size={size} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Web3"
        options={{
          title: 'Web3',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => <TabIcon glyph="⛓" color={color} size={size} focused={focused} />,
        }}
      >
        {() => <Web3Stack onOpenWallet={onOpenWallet} />}
      </Tab.Screen>
      <Tab.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{
          title: 'Checkout',
          tabBarIcon: ({ color, size, focused }) => <TabIcon glyph="💳" color={color} size={size} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size, focused }) => <TabIcon glyph="📋" color={color} size={size} focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerFocused: {
    backgroundColor: 'rgba(201, 168, 76, 0.15)',
  },
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

