import { Stack } from 'expo-router';
import { CareerProvider } from '../src/lifecycle/CareerProvider';

export default function RootLayout() {
  return (
    <CareerProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Sport Sim' }} />
        <Stack.Screen name="diagnostics" options={{ title: 'Diagnostics' }} />
      </Stack>
    </CareerProvider>
  );
}