import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CameraProvider } from '../src/state/CameraContext';
import { C } from '../src/ui/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <CameraProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
      </CameraProvider>
    </SafeAreaProvider>
  );
}
