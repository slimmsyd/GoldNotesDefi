import 'react-native-get-random-values';
import { StatusBar } from 'expo-status-bar';
import { Buffer } from 'buffer';
import { MobileNavigation } from './src/navigation';

if (!(global as { Buffer?: typeof Buffer }).Buffer) {
  (global as { Buffer?: typeof Buffer }).Buffer = Buffer;
}

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <MobileNavigation />
    </>
  );
}
