import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { queryClient } from '@/api/queryClient';
import { useAppStore } from '@/store/useAppStore';
import { Colors } from '@/constants/theme';
import '@/i18n';

function AppInitializer({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const login = useAppStore((s) => s.login);

  useEffect(() => {
    async function initializeApp() {
      try {
        const accessToken = await SecureStore.getItemAsync('accessToken').catch(() => null);
        const refreshToken = await SecureStore.getItemAsync('refreshToken').catch(() => null);
        const employeeStr = await SecureStore.getItemAsync('employee').catch(() => null);

        if (accessToken && refreshToken && employeeStr) {
          // Check for biometrics availability
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();

          if (hasHardware && isEnrolled) {
            const authResult = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Sign in to Nirmaan',
              fallbackLabel: 'Use passcode',
            });

            if (authResult.success) {
              const employee = JSON.parse(employeeStr);
              login(accessToken, {
                id: employee.id,
                name: employee.name,
                phone: employee.phone,
                role: employee.accessRole || employee.role,
                orgLevel: employee.orgLevel,
              });
            }
          } else {
            // Biometrics not available/enrolled, but session exists. Proceed to restore session directly.
            const employee = JSON.parse(employeeStr);
            login(accessToken, {
              id: employee.id,
              name: employee.name,
              phone: employee.phone,
              role: employee.accessRole || employee.role,
              orgLevel: employee.orgLevel,
            });
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsReady(true);
      }
    }

    initializeApp();
  }, [login]);

  if (!isReady) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <AppInitializer>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AppInitializer>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    backgroundColor: Colors.background || '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
