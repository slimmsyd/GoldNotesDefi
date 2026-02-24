import { useCallback, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SplashScreen } from '../screens/splash/SplashScreen';
import { WalletSheet } from '../components/wallet/WalletSheet';
import { MainTabs } from './MainTabs';

export type RootStackParamList = {
  Splash: undefined;
  MainTabs: undefined;
};

export type { MainTabParamList } from './MainTabs';
export type { Web3StackParamList } from './Web3Stack';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function MobileNavigation() {
  const [walletVisible, setWalletVisible] = useState(false);
  const openWallet = useCallback(() => setWalletVisible(true), []);
  const closeWallet = useCallback(() => setWalletVisible(false), []);

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="MainTabs">
            {() => <MainTabs onOpenWallet={openWallet} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
      <WalletSheet visible={walletVisible} onClose={closeWallet} />
    </>
  );
}
