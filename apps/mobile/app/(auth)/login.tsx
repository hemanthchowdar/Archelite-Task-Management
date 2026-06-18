import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/api/queryClient';
import { useAppStore } from '@/store/useAppStore';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const login = useAppStore((s) => s.login);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasBiometrics, setHasBiometrics] = useState(false);

  useEffect(() => {
    async function checkBiometrics() {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const savedToken = await SecureStore.getItemAsync('accessToken').catch(() => null);
        setHasBiometrics(hasHardware && isEnrolled && !!savedToken);
      } catch (e) {
        setHasBiometrics(false);
      }
    }
    checkBiometrics();
  }, []);

  const handleBiometricUnlock = async () => {
    setError(null);
    try {
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Nirmaan',
        fallbackLabel: 'Use passcode',
      });

      if (authResult.success) {
        const accessToken = await SecureStore.getItemAsync('accessToken');
        const employeeStr = await SecureStore.getItemAsync('employee');
        if (accessToken && employeeStr) {
          const employee = JSON.parse(employeeStr);
          login(accessToken, {
            id: employee.id,
            name: employee.name,
            phone: employee.phone,
            role: employee.accessRole || employee.role,
            orgLevel: employee.orgLevel,
          });
          router.replace('/(app)/(tabs)/tasks');
        } else {
          setError('No saved session found.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Biometric authentication failed.');
    }
  };

  const handleSendOtp = async () => {
    if (phone.length < 10) return;
    setLoading(true);
    setError(null);

    try {
      await apiFetch('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      router.push({ pathname: '/(auth)/otp', params: { phone } });
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inner}>
          
          <View style={styles.mainContent}>
            {/* Logo / Brand */}
            <View style={styles.brandSection}>
              <View style={styles.logoSquare}>
                <Ionicons name="home" size={42} color="#1E293B" />
              </View>
              <Text style={styles.title}>Welcome to Nirmaan</Text>
              <Text style={styles.subtitle}>Sign in with your phone number</Text>
            </View>

            {/* Phone Input */}
            <View style={styles.inputSection}>
              <Text style={styles.label}>Phone number</Text>
              <View style={styles.inputRow}>
                <Text style={styles.countryCodeText}>+91</Text>
                <TextInput
                  style={styles.input}
                  placeholder="98765 43210"
                  placeholderTextColor="#A0AEC0"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                  autoFocus
                  selectionColor={Colors.primary}
                  editable={!loading}
                />
              </View>
              <Text style={styles.smsDisclaimer}>We'll send a one-time code by SMS</Text>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Continue Button */}
            <TouchableOpacity
              style={[styles.button, (phone.length < 10 || loading) && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={phone.length < 10 || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#1E293B" size="small" />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </TouchableOpacity>

            {/* Or Separator */}
            <View style={styles.separatorContainer}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>or</Text>
              <View style={styles.separatorLine} />
            </View>

            {/* Use email instead link */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert('Unsupported', 'Email sign-in is not supported. Please authenticate using your phone number.')}
            >
              <Text style={styles.emailLinkText}>Use email instead</Text>
            </TouchableOpacity>
          </View>

          {/* Unlock with fingerprint */}
          {hasBiometrics && (
            <TouchableOpacity
              style={styles.fingerprintContainer}
              onPress={handleBiometricUnlock}
              activeOpacity={0.7}
            >
              <Ionicons name="finger-print-outline" size={22} color="#64748B" />
              <Text style={styles.fingerprintText}>Unlock with fingerprint</Text>
            </TouchableOpacity>
          )}

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 20,
    marginTop: 40,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoSquare: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 58,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  countryCodeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  smsDisclaimer: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 10,
    fontWeight: '400',
  },
  button: {
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    width: '100%',
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  separatorText: {
    marginHorizontal: 12,
    color: '#94A3B8',
    fontSize: 14,
  },
  emailLinkText: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  fingerprintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  fingerprintText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 8,
  },
  errorText: {
    color: Colors.error || '#D32F2F',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
});
