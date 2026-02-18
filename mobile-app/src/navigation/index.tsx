import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useCallback, useState } from 'react';
import { SplashScreen } from '../screens/splash/SplashScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ShopScreen } from '../screens/shop/ShopScreen';
import { CheckoutScreen } from '../screens/checkout/CheckoutScreen';
import { RedeemScreen } from '../screens/web3/RedeemScreen';
import { WalletSheet } from '../components/wallet/WalletSheet';
import { tokens } from '../theme/tokens';

export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  Shop: undefined;
  Checkout: undefined;
  Redeem: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function MobileNavigation() {
  const [walletVisible, setWalletVisible] = useState(false);
  const openWallet = useCallback(() => setWalletVisible(true), []);
  const closeWallet = useCallback(() => setWalletVisible(false), []);
  const isIOS = Platform.OS === 'ios';

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{
            headerShadowVisible: false,
            headerLargeTitle: isIOS,
            headerTransparent: isIOS,
            headerStyle: {
              backgroundColor: isIOS ? 'transparent' : tokens.colors.bgBase,
            },
            headerTitleStyle: {
              color: tokens.colors.textPrimary,
              fontWeight: '700',
            },
            headerTintColor: tokens.colors.textPrimary,
            contentStyle: {
              backgroundColor: tokens.colors.bgBase,
            },
          }}
        >
          <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: '',
              headerRight: () => (
                <Pressable onPress={openWallet} hitSlop={10} style={styles.walletButton}>
                  <Text style={styles.walletButtonText}>Wallet</Text>
                </Pressable>
              ),
            }}
          />
          <Stack.Screen
            name="Shop"
            component={ShopScreen}
            options={{
              title: 'GoldBack Shop',
              headerRight: () => (
                <Pressable onPress={openWallet} hitSlop={10} style={styles.walletButton}>
                  <Text style={styles.walletButtonText}>Wallet</Text>
                </Pressable>
              ),
            }}
          />
          <Stack.Screen
            name="Checkout"
            component={CheckoutScreen}
            options={{
              title: 'Checkout',
              headerRight: () => (
                <Pressable onPress={openWallet} hitSlop={10} style={styles.walletButton}>
                  <Text style={styles.walletButtonText}>Wallet</Text>
                </Pressable>
              ),
            }}
          />
          <Stack.Screen
            name="Redeem"
            component={RedeemScreen}
            options={{
              title: 'Withdraw',
              headerRight: () => (
                <Pressable onPress={openWallet} hitSlop={10} style={styles.walletButton}>
                  <Text style={styles.walletButtonText}>Wallet</Text>
                </Pressable>
              ),
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <WalletSheet visible={walletVisible} onClose={closeWallet} />
    </>
  );
}

const styles = StyleSheet.create({
  walletButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm - 1,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#ffffffd9',
    borderWidth: 1,
    borderColor: tokens.colors.hairline,
  },
  walletButtonText: {
    color: tokens.colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
