import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CameraProvider } from '../src/state/CameraContext';
import { ProblemProvider } from '../src/state/ProblemContext';
import { ProblemBanner } from '../src/ui/ProblemBanner';
import { UpdateGate } from '../src/ui/UpdateGate';
import { C } from '../src/ui/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <CameraProvider>
        <ProblemProvider>
          <StatusBar style="light" />
          <UpdateGate>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
            <ProblemBanner />
          </UpdateGate>
        </ProblemProvider>
      </CameraProvider>
    </SafeAreaProvider>
  );
}
