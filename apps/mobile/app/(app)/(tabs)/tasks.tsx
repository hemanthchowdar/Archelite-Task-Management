import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Colors, Fonts, Spacing, Radius, avatarColor } from '@/constants/theme';
import { apiFetch } from '@/api/queryClient';
import { useAppStore } from '@/store/useAppStore';

// ── Types ─────────────────────────────────────────────
interface TaskAssignment {
  employeeId: string;
  role: string;
  employee: {
    id: string;
    name: string;
  };
}

interface Category {
  id: string;
  key: string;
  labelEn: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  lastActivityAt: string;
  category: Category | null;
  assignments: TaskAssignment[];
  _count?: { comments: number };
}

// ── Constants ──────────────────────────────────────────
type FilterKey = 'all' | 'myTasks' | 'overdue';

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  bookkeeping: { bg: Colors.bookkeeping, text: Colors.bookkeepingText },
  construction: { bg: Colors.construction, text: Colors.constructionText },
  accounting: { bg: Colors.accounting, text: Colors.accountingText },
  invoice: { bg: Colors.invoice, text: Colors.invoiceText },
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: Colors.urgent,
  critical: Colors.critical,
  high: Colors.high,
  medium: Colors.medium,
  low: Colors.low,
};

const STATUS_LABEL: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  needs_action: 'Needs Action',
  needs_verification: 'Needs Verification',
  closed: 'Closed',
};

// ── TaskCard Component ─────────────────────────────────
function TaskCard({ task, onPress }: { task: Task; onPress: () => void }) {
  const isClosed = task.status === 'closed';
  const firstAssignee = task.assignments[0]?.employee?.name ?? '?';
  const categoryKey = task.category?.key ?? '';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          { backgroundColor: avatarColor(firstAssignee) },
        ]}
      >
        <Text style={styles.avatarText}>{firstAssignee.charAt(0).toUpperCase()}</Text>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text
            style={[styles.taskTitle, isClosed && styles.taskTitleClosed]}
            numberOfLines={1}
          >
            {task.title}
          </Text>
          <Text style={styles.taskTime}>
            {task.dueDate
              ? new Date(task.dueDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })
              : STATUS_LABEL[task.status] ?? task.status}
          </Text>
        </View>

        <View style={styles.cardBottomRow}>
          <View style={styles.messageRow}>
            <View
              style={[
                styles.priorityDot,
                { backgroundColor: PRIORITY_DOT[task.priority] ?? Colors.medium },
              ]}
            />
            <Text
              style={[styles.lastMessage, isClosed && styles.lastMessageClosed]}
              numberOfLines={1}
            >
              {task.assignments.length} assignee
              {task.assignments.length !== 1 ? 's' : ''} · {task.priority}
            </Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          {/* Category Badge */}
          {task.category && (
            <View
              style={[
                styles.categoryBadge,
                {
                  backgroundColor:
                    CATEGORY_STYLES[categoryKey]?.bg ?? Colors.surfaceMuted,
                },
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  {
                    color:
                      CATEGORY_STYLES[categoryKey]?.text ?? Colors.textSecondary,
                  },
                ]}
              >
                {task.category.labelEn}
              </Text>
            </View>
          )}

          {/* Status chip */}
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>
              {STATUS_LABEL[task.status] ?? task.status}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────
export default function TasksScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const employee = useAppStore((s) => s.employee);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  // ── Fetch tasks from live API ──────────────────────
  const {
    data: tasks,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<Task[]>({
    queryKey: ['tasks', employee?.id],
    queryFn: () => apiFetch<Task[]>('/tasks'),
    refetchInterval: 3000,
  });

  // ── Client-side filter logic ───────────────────────
  const filteredTasks = useCallback(() => {
    if (!tasks) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (activeFilter) {
      case 'myTasks':
        return tasks.filter((t) =>
          t.assignments.some((a) => a.employeeId === employee?.id)
        );
      case 'overdue':
        return tasks.filter(
          (t) =>
            t.dueDate &&
            new Date(t.dueDate) < today &&
            t.status !== 'closed'
        );
      default:
        return tasks;
    }
  }, [tasks, activeFilter, employee?.id]);

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('tasks.all') },
    { key: 'myTasks', label: t('tasks.myTasks') },
    { key: 'overdue', label: t('tasks.overdue') },
  ];

  const displayTasks = filteredTasks();

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
        {tasks && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{displayTasks.length}</Text>
          </View>
        )}
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

      {/* ── Loading / Error / List ───────────── */}
      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centerStateText}>Loading tasks…</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.centerStateText}>Could not load tasks</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : displayTasks.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="checkmark-done-circle-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.centerStateText}>No tasks found</Text>
        </View>
      ) : (
        <FlashList
          data={displayTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onRefresh={() => { refetch(); }}
          refreshing={isFetching && !isLoading}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onPress={() => router.push(`/(app)/task/${item.id}`)}
            />
          )}
        />
      )}

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

// ── Styles ─────────────────────────────────────────────
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  pageTitle: {
    fontSize: Fonts.sizes.title,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  countBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
    color: Colors.primaryDark,
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
    gap: Spacing.sm,
    flexWrap: 'wrap',
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
  statusChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statusChipText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  // ── Center States ────────
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingBottom: 80,
  },
  centerStateText: {
    fontSize: Fonts.sizes.md,
    color: Colors.textMuted,
  },
  retryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  retryText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.textOnPrimary,
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
