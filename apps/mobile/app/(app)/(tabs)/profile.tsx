import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Language } from '@/store/useAppStore';
import { Colors, Fonts, Spacing, Radius, avatarColor } from '@/constants/theme';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
];

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const employee = useAppStore((s) => s.employee);
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const logout = useAppStore((s) => s.logout);

  const name = employee?.name ?? 'Archelite User';
  const role = employee?.role ?? 'ADMIN';
  const initial = name.charAt(0).toUpperCase();

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ──────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
      </View>

      <View style={styles.content}>
        {/* ── Avatar Card ──────────────────── */}
        <View style={styles.profileCard}>
          <View
            style={[styles.avatar, { backgroundColor: avatarColor(initial) }]}
          >
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.role}>{role}</Text>
          <TouchableOpacity style={styles.editButton}>
            <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
            <Text style={styles.editText}>{t('profile.editProfile')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Language Picker ──────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
          <View style={styles.langRow}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langChip,
                  language === lang.code && styles.langChipActive,
                ]}
                onPress={() => setLanguage(lang.code)}
              >
                <Text
                  style={[
                    styles.langText,
                    language === lang.code && styles.langTextActive,
                  ]}
                >
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Settings ─────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.menuRow}>
            <Ionicons
              name="settings-outline"
              size={20}
              color={Colors.textSecondary}
            />
            <Text style={styles.menuText}>{t('profile.settings')}</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.textMuted}
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>
        </View>

        {/* ── Logout ───────────────────────── */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.header,
  },
  headerTitle: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.headerText,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  // ── Profile Card ────────
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xxl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  name: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  role: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  // ── Sections ────────────
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  langRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  langChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  langChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  langText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  langTextActive: {
    color: Colors.textOnPrimary,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 4,
  },
  menuText: {
    fontSize: Fonts.sizes.lg,
    color: Colors.textPrimary,
  },
  // ── Logout ──────────────
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    marginTop: 'auto',
    marginBottom: Spacing.xxl,
  },
  logoutText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
    color: Colors.error,
  },
});
