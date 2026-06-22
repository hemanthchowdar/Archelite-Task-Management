import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, Radius, avatarColor } from '@/constants/theme';

// ── Mock Data ─────────────────────────────────────────
const MOCK_TASKS = [
  {
    id: '1',
    title: 'Submit GST filing documents',
    lastMessage: 'Anil: Will upload by today',
    category: 'Bookkeeping',
    time: '8:02 AM',
    avatar: 'G',
    unread: 1,
    priority: 'high' as const,
    closed: false,
  },
  {
    id: '2',
    title: 'Foundation photos – Towe…',
    lastMessage: '3 photos added',
    category: 'Construction',
    time: 'Yesterday',
    avatar: 'T',
    unread: 0,
    priority: 'medium' as const,
    closed: false,
  },
  {
    id: '3',
    title: 'Reconcile petty cash –…',
    lastMessage: 'Closed by Lakshmi',
    category: 'Bookkeeping',
    time: 'Yesterday',
    avatar: 'P',
    unread: 0,
    priority: 'low' as const,
    closed: true,
  },
  {
    id: '4',
    title: 'Cement Vendor Approval',
    lastMessage: 'Ramesh: Please process urgently',
    category: 'Invoice',
    time: '2 days ago',
    avatar: 'R',
    unread: 0,
    priority: 'urgent' as const,
    closed: false,
    hasAttachment: true,
  },
];

type FilterKey = 'all' | 'myTasks' | 'overdue';

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  Bookkeeping: { bg: Colors.bookkeeping, text: Colors.bookkeepingText },
  Construction: { bg: Colors.construction, text: Colors.constructionText },
  Accounting: { bg: Colors.accounting, text: Colors.accountingText },
  Invoice: { bg: Colors.invoice, text: Colors.invoiceText },
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: Colors.urgent,
  critical: Colors.critical,
  high: Colors.high,
  medium: Colors.medium,
  low: Colors.low,
};

export default function TasksScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('tasks.all') },
    { key: 'myTasks', label: t('tasks.myTasks') },
    { key: 'overdue', label: t('tasks.overdue') },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ──────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="menu" size={24} color={Colors.headerText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('common.appName')}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="search" size={22} color={Colors.headerText} />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons
              name="ellipsis-vertical"
              size={22}
              color={Colors.headerText}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Page Title ──────────────────────── */}
      <View style={styles.titleSection}>
        <Text style={styles.pageTitle}>{t('tasks.title')}</Text>
      </View>

      {/* ── Filter Chips ────────────────────── */}
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

      {/* ── Task List ───────────────────────── */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {MOCK_TASKS.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => router.push(`/(app)/task/${task.id}`)}
          >
            {/* Avatar */}
            <View
              style={[
                styles.avatar,
                { backgroundColor: avatarColor(task.avatar) },
              ]}
            >
              <Text style={styles.avatarText}>{task.avatar}</Text>
            </View>

            {/* Content */}
            <View style={styles.cardContent}>
              <View style={styles.cardTopRow}>
                <Text
                  style={[
                    styles.taskTitle,
                    task.closed && styles.taskTitleClosed,
                  ]}
                  numberOfLines={1}
                >
                  {task.title}
                </Text>
                <Text style={styles.taskTime}>{task.time}</Text>
              </View>

              <View style={styles.cardBottomRow}>
                <View style={styles.messageRow}>
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: PRIORITY_DOT[task.priority] },
                    ]}
                  />
                  <Text
                    style={[
                      styles.lastMessage,
                      task.closed && styles.lastMessageClosed,
                    ]}
                    numberOfLines={1}
                  >
                    {task.lastMessage}
                  </Text>
                </View>
              </View>

              <View style={styles.cardMeta}>
                {/* Category Badge */}
                <View
                  style={[
                    styles.categoryBadge,
                    {
                      backgroundColor:
                        CATEGORY_STYLES[task.category]?.bg ?? Colors.surfaceMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      {
                        color:
                          CATEGORY_STYLES[task.category]?.text ??
                          Colors.textSecondary,
                      },
                    ]}
                  >
                    {task.category}
                  </Text>
                </View>

                {/* Unread Badge */}
                {task.unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{task.unread}</Text>
                  </View>
                )}

                {/* Attachment icon */}
                {task.hasAttachment && (
                  <Ionicons
                    name="document-text-outline"
                    size={16}
                    color={Colors.textMuted}
                    style={{ marginLeft: Spacing.sm }}
                  />
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── FAB ─────────────────────────────── */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push('/(app)/task/create')}
      >
        <Ionicons name="add" size={28} color={Colors.textOnPrimary} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // ── Header ──────────────
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
  headerRight: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  headerIcon: {
    marginRight: 0,
  },
  // ── Title ───────────────
  titleSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  pageTitle: {
    fontSize: Fonts.sizes.title,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  // ── Filters ─────────────
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
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
  // ── List ────────────────
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  // ── Card ────────────────
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: '#fff',
  },
  cardContent: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskTitle: {
    flex: 1,
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  taskTitleClosed: {
    textDecorationLine: 'line-through',
    color: Colors.closedStrikethrough,
  },
  taskTime: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
  },
  cardBottomRow: {
    marginBottom: 6,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  lastMessage: {
    flex: 1,
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
  },
  lastMessageClosed: {
    color: Colors.closedStrikethrough,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  categoryText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
  },
  unreadBadge: {
    marginLeft: 'auto',
    backgroundColor: Colors.unreadBadge,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
  },
  // ── FAB ─────────────────
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.fab,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
});
