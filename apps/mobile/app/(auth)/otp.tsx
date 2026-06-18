import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { useAppStore } from '@/store/useAppStore';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import { apiFetch } from '@/api/queryClient';

const OTP_LENGTH = 6;

export default function OtpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const login = useAppStore((s) => s.login);

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Auto‑focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);

    // Auto‑advance
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto‑submit when last digit entered
    if (digit && index === OTP_LENGTH - 1) {
      const code = next.join('');
      if (code.length === OTP_LENGTH) {
        handleVerify(code);
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        employee: {
          id: string;
          name: string;
          phone: string;
          accessRole: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
          orgLevel: number;
          preferredLanguage: 'en' | 'hi' | 'te' | null;
        };
      }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, otp: code }),
      });

      // Save tokens in SecureStore
      await SecureStore.setItemAsync('accessToken', res.accessToken);
      await SecureStore.setItemAsync('refreshToken', res.refreshToken);

      // Log in to global zustand app store mapping accessRole -> role
      login(res.accessToken, {
        id: res.employee.id,
        name: res.employee.name,
        phone: res.employee.phone,
        role: res.employee.accessRole,
        orgLevel: res.employee.orgLevel,
      });

      // Navigate appropriately
      if (!res.employee.preferredLanguage) {
        // Un-onboarded user: send to language selection screen
        router.replace('/(app)/(tabs)/profile');
      } else {
        router.replace('/(app)/(tabs)/tasks');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!phone) return;
    setError(null);
    try {
      await apiFetch('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      setCountdown(30);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Back arrow area */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} disabled={loading}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('auth.otpTitle')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.otpSubtitle')} {phone}
        </Text>

        {/* OTP Boxes */}
        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputRefs.current[i] = ref; }}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={(text) => handleChange(text, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              editable={!loading}
            />
          ))}
        </View>

        {/* Resend */}
        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={styles.resendTimer}>
              {t('auth.resendIn', { seconds: countdown })}
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={loading}>
              <Text style={styles.resendLink}>{t('auth.resendOtp')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Verify Button */}
        <TouchableOpacity
          style={[
            styles.button,
            (otp.join('').length < OTP_LENGTH || loading) && styles.buttonDisabled,
          ]}
          onPress={() => handleVerify(otp.join(''))}
          disabled={otp.join('').length < OTP_LENGTH || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textOnPrimary} size="small" />
          ) : (
            <Text style={styles.buttonText}>{t('auth.verifyOtp')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: 80,
  },
  backButton: {
    marginBottom: Spacing.xxl,
  },
  backArrow: {
    fontSize: 24,
    color: Colors.textPrimary,
  },
  title: {
    fontSize: Fonts.sizes.xxl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Fonts.sizes.md,
    color: Colors.textSecondary,
    marginBottom: 40,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  otpBox: {
    flex: 1,
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  otpBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  resendTimer: {
    fontSize: Fonts.sizes.md,
    color: Colors.textMuted,
  },
  resendLink: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  button: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  errorText: {
    color: Colors.error,
    fontSize: Fonts.sizes.md,
    marginBottom: Spacing.md,
    textAlign: 'center',
    fontWeight: '500',
  },
});
