import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCameraState } from '../../src/state/CameraContext';
import { C } from '../../src/ui/theme';

export default function TabsLayout() {
  const state = useCameraState();

  // connessione persa definitivamente o chiusa: torna alla schermata di connessione
  useEffect(() => {
    if (state.status === 'disconnected' || state.status === 'error') router.replace('/');
  }, [state.status]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.border },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen
        name="controllo"
        options={{ title: 'Controllo', tabBarIcon: ({ color, size }) => <Ionicons name="aperture-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="galleria"
        options={{ title: 'Galleria', tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="impostazioni"
        options={{ title: 'Impostazioni', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
