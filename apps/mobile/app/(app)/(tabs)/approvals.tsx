import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, Radius, avatarColor } from '@/constants/theme';

// ── Mock Data ─────────────────────────────────────────
const MOCK_APPROVALS = [
  {
    id: '1',
    title: 'Cement Procurement: 500 Bags',
    status: 'URGENT',
    statusColor: Colors.urgent,
    requester: 'Ramesh Kumar',
    role: 'Site Supervisor',
    time: 'Today, 10:45 AM',
    avatar: 'R',
    amountLabel: 'AMOUNT',
    amount: '₹2,45,000',
    linkLabel: 'View PO',
    icon: 'copy-outline' as const,
  },
  {
    id: '2',
    title: 'GST Filing - Oct Quarter',
    status: 'NEEDS VERIFICATION',
    statusColor: Colors.warning,
    requester: 'Anjali Gupta',
    role: 'Accountant',
    time: 'Yesterday',
    avatar: 'A',
    amountLabel: 'INVOICE TOTAL',
    amount: '₹45,800',
    linkLabel: 'Invoice.pdf',
    icon: 'document-outline' as const,
  },
  {
    id: '3',
    title: 'Daily Labor Wages: Tower 4',
    status: 'ROUTINE',
    statusColor: Colors.textMuted,
    requester: 'Vikram Singh',
    role: 'Project Engineer',
    time: '2 days ago',
    avatar: 'V',
    amountLabel: 'TOTAL PAYOUT',
    amount: '₹12,400',
    linkLabel: 'View Attendance',
    icon: 'people-outline' as const,
  },
];

type ApprovalFilter = 'all' | 'highPriority' | 'invoices';

export default function ApprovalsScreen() {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<ApprovalFilter>('all');

  const filters: { key: ApprovalFilter; label: string }[] = [
    { key: 'all', label: t('approvals.allRequests') },
    { key: 'highPriority', label: t('approvals.highPriority') },
    { key: 'invoices', label: t('approvals.invoices') },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ──────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="menu" size={24} color={Colors.headerText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('common.appName')}</Text>
        <TouchableOpacity>
          <Ionicons name="search" size={22} color={Colors.headerText} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Title + Pending Badge ────────── */}
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>{t('approvals.title')}</Text>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>
              {t('approvals.pending', { count: 4 })}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>{t('approvals.subtitle')}</Text>

        {/* ── Filter Chips ────────────────── */}
        <View style={styles.filterRow}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                activeFilter === f.key && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === f.key && styles.filterTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Approval Cards ──────────────── */}
        {MOCK_APPROVALS.map((item) => (
          <View key={item.id} style={styles.card}>
            {/* Status label */}
            <View style={styles.cardStatusRow}>
              <Text style={[styles.statusLabel, { color: item.statusColor }]}>
                {item.status}
              </Text>
              <Ionicons
                name={item.icon}
                size={20}
                color={Colors.textMuted}
              />
            </View>

            {/* Title */}
            <Text style={styles.cardTitle}>{item.title}</Text>

            {/* Requester */}
            <View style={styles.requesterRow}>
              <View
                style={[
                  styles.requesterAvatar,
                  { backgroundColor: avatarColor(item.avatar) },
                ]}
              >
                <Text style={styles.requesterAvatarText}>{item.avatar}</Text>
              </View>
              <View>
                <Text style={styles.requesterName}>{item.requester}</Text>
                <Text style={styles.requesterMeta}>
                  {item.role} • {item.time}
                </Text>
              </View>
            </View>

            {/* Amount row */}
            <View style={styles.amountRow}>
              <View>
                <Text style={styles.amountLabel}>{item.amountLabel}</Text>
                <Text style={styles.amountValue}>{item.amount}</Text>
              </View>
              <TouchableOpacity style={styles.linkButton}>
                <Ionicons
                  name="eye-outline"
                  size={14}
                  color={Colors.primary}
                />
                <Text style={styles.linkText}>{item.linkLabel}</Text>
              </TouchableOpacity>
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.rejectButton}>
                <Text style={styles.rejectText}>{t('approvals.reject')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.approveButton}>
                <Text style={styles.approveText}>{t('approvals.approve')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.header,
  },
  headerTitle: {
    flex: 1,
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.headerText,
    marginLeft: Spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  pageTitle: {
    fontSize: Fonts.sizes.title,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pendingBadge: {
    marginLeft: Spacing.md,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  pendingText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  subtitle: {
    fontSize: Fonts.sizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterChipActive: {
    backgroundColor: Colors.header,
    borderColor: Colors.header,
  },
  filterText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.headerText,
  },
  // ── Card ────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statusLabel: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  requesterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  requesterAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  requesterAvatarText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
    color: '#fff',
  },
  requesterName: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  requesterMeta: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  amountLabel: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  linkText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  rejectButton: {
    flex: 1,
    height: 40,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  approveButton: {
    flex: 1,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
