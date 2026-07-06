import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing, Radius, avatarColor } from '@/constants/theme';
import { apiFetch } from '@/api/queryClient';
import { useAppStore } from '@/store/useAppStore';

// ── Types ──────────────────────────────────────────────
interface Employee {
  id: string;
  name: string;
  email?: string;
}

interface ApprovalRequest {
  id: string;
  taskId: string;
  approverId: string;
  status: 'pending' | 'approved' | 'rejected';
  decisionComment?: string;
  createdAt: string;
  requestedBy: Employee;
  approver: Employee;
}

interface TaskWithApprovals {
  id: string;
  title: string;
  priority: string;
  status: string;
  approvals: ApprovalRequest[];
}

// ── Priority colours ────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  urgent: Colors.urgent,
  critical: Colors.critical,
  high: Colors.high,
  medium: Colors.medium,
  low: Colors.low,
};

function relativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  const timeStr = `${hours}.${minutesStr} ${ampm}`;

  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return timeStr;
  } else if (isYesterday) {
    return `Yesterday, ${timeStr}`;
  } else {
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    return `${day} ${month}, ${timeStr}`;
  }
}

export default function ApprovalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const actor = useAppStore((s) => s.employee);

  // Decision modal state
  const [decisionModal, setDecisionModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithApprovals | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const [comment, setComment] = useState('');

  // ── Fetch tasks where I am a pending approver ──────
  const { data: tasks = [], isLoading, refetch } = useQuery<TaskWithApprovals[]>({
    queryKey: ['my-approvals', actor?.id],
    queryFn: () => apiFetch<TaskWithApprovals[]>('/tasks/my-approvals'),
    enabled: !!actor?.id,
    refetchInterval: 3000,
  });

  const pendingCount = tasks.reduce(
    (acc, t) =>
      acc + (t.approvals?.filter((a) => a.status === 'pending').length ?? 0),
    0
  );

  // ── Mutation: decide on approval ────────────────────────
  const decisionMutation = useMutation({
    mutationFn: ({
      taskId,
      approvalId,
      status,
      decisionComment,
    }: {
      taskId: string;
      approvalId: string;
      status: 'approved' | 'rejected';
      decisionComment: string;
    }) =>
      apiFetch(`/tasks/${taskId}/approvals/${approvalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, decisionComment }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDecisionModal(false);
      setComment('');
      setSelectedApproval(null);
      setSelectedTask(null);
      setDecision(null);
    },
    onError: (err: Error) => {
      Alert.alert('Failed', err.message);
    },
  });

  const openDecision = (
    task: TaskWithApprovals,
    approval: ApprovalRequest,
    d: 'approved' | 'rejected'
  ) => {
    setSelectedTask(task);
    setSelectedApproval(approval);
    setDecision(d);
    setComment('');
    setDecisionModal(true);
  };

  const submitDecision = () => {
    if (!selectedTask || !selectedApproval || !decision) return;
    if (!comment.trim()) {
      Alert.alert('Comment Required', 'Please enter a comment before submitting.');
      return;
    }
    decisionMutation.mutate({
      taskId: selectedTask.id,
      approvalId: selectedApproval.id,
      status: decision,
      decisionComment: comment.trim(),
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ──────────────────────────── */}
      <View style={styles.header}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>{t('common.appName')}</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Ionicons name="refresh-outline" size={22} color={Colors.headerText} />
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
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>
                {pendingCount} pending
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>Tasks waiting for your approval</Text>

        {/* ── States ──────────────────────── */}
        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.centerText}>Loading approvals…</Text>
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.centerState}>
            <Ionicons name="checkmark-circle-outline" size={56} color={Colors.success} />
            <Text style={styles.centerTitle}>All clear!</Text>
            <Text style={styles.centerText}>No pending approvals for you right now.</Text>
          </View>
        ) : (
          tasks.map((task) => {
            const myApprovals = task.approvals.filter(
              (a) => a.approverId === actor?.id
            );
            const allDecided = myApprovals.length > 0 && myApprovals.every((a) => a.status !== 'pending');
            const priorityColor = PRIORITY_COLORS[task.priority] ?? Colors.medium;

            return (
              <View key={task.id} style={[styles.card, allDecided && { opacity: 0.75 }]}>
                {/* Priority + Task title */}
                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: priorityColor },
                    ]}
                  />
                  <Text
                    style={[styles.priorityLabel, { color: priorityColor }]}
                  >
                    {task.priority.toUpperCase()}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => router.push(`/task/${task.id}` as any)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.cardTitle,
                      allDecided && { textDecorationLine: 'line-through', color: Colors.textMuted },
                    ]}
                  >
                    {task.title}
                  </Text>
                </TouchableOpacity>

                {/* Each approval on this task for me */}
                {myApprovals.map((approval) => {
                  const isPending = approval.status === 'pending';
                  const isApproved = approval.status === 'approved';

                  return (
                    <View key={approval.id} style={{ marginTop: 8 }}>
                      {/* Requester row */}
                      <View style={styles.requesterRow}>
                        <View
                          style={[
                            styles.requesterAvatar,
                            {
                              backgroundColor: avatarColor(
                                approval.requestedBy.name
                              ),
                            },
                          ]}
                        >
                          <Text style={styles.requesterAvatarText}>
                            {approval.requestedBy.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.requesterName}>
                            {approval.requestedBy.name}
                          </Text>
                          <Text style={styles.requesterMeta}>
                            Requested approval · {relativeTime(approval.createdAt)}
                          </Text>
                        </View>
                      </View>

                      {isPending ? (
                        /* Action buttons */
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={styles.rejectButton}
                            onPress={() => openDecision(task, approval, 'rejected')}
                          >
                            <Ionicons name="close" size={16} color={Colors.textPrimary} />
                            <Text style={styles.rejectText}>{t('approvals.reject')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.approveButton}
                            onPress={() => openDecision(task, approval, 'approved')}
                          >
                            <Ionicons name="checkmark" size={16} color="#fff" />
                            <Text style={styles.approveText}>{t('approvals.approve')}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        /* Decided status row */
                        <View style={styles.decidedStatusRow}>
                          <Ionicons
                            name={isApproved ? 'checkmark-circle' : 'close-circle'}
                            size={16}
                            color={isApproved ? Colors.success : Colors.error}
                          />
                          <Text
                            style={[
                              styles.decidedStatusText,
                              { color: isApproved ? Colors.success : Colors.error }
                            ]}
                          >
                            {isApproved ? 'Approved' : 'Rejected'}
                            {approval.decisionComment ? ` · ${approval.decisionComment}` : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Decision Modal ───────────────────── */}
      <Modal
        visible={decisionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setDecisionModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDecisionModal(false)}
        >
          <View style={styles.decisionSheet}>
            <View style={styles.sheetHandle} />

            <Text style={styles.decisionTitle}>
              {decision === 'approved' ? '✅ Approve Task' : '❌ Reject Task'}
            </Text>
            <Text style={styles.decisionTaskName} numberOfLines={2}>
              {selectedTask?.title}
            </Text>

            <Text style={styles.commentLabel}>
              {decision === 'approved'
                ? 'Add an approval note (required)'
                : 'Reason for rejection (required)'}
            </Text>
            <TextInput
              style={styles.commentInput}
              placeholder={
                decision === 'approved'
                  ? 'e.g. Looks good, proceed…'
                  : 'e.g. Missing documents…'
              }
              placeholderTextColor={Colors.textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              autoFocus
            />

            <View style={styles.decisionActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDecisionModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  decision === 'rejected' && styles.submitBtnReject,
                  (!comment.trim() || decisionMutation.isPending) &&
                    styles.submitBtnDisabled,
                ]}
                onPress={submitDecision}
                disabled={!comment.trim() || decisionMutation.isPending}
              >
                {decisionMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {decision === 'approved' ? 'Approve' : 'Reject'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.header,
  },
  headerTitle: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.headerText,
  },
  scrollView: { flex: 1 },
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
  // ── Empty / Loading states
  centerState: {
    alignItems: 'center',
    paddingVertical: 64,
    gap: Spacing.md,
  },
  centerTitle: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  centerText: {
    fontSize: Fonts.sizes.md,
    color: Colors.textMuted,
    textAlign: 'center',
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
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityLabel: {
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
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  requesterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requesterAvatarText: {
    fontSize: Fonts.sizes.md,
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
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 4,
  },
  rejectButton: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  rejectText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  approveButton: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  approveText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: '#fff',
  },
  // ── Decision Modal ───────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  decisionSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 36,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  decisionTitle: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  decisionTaskName: {
    fontSize: Fonts.sizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  commentLabel: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceMuted,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: Spacing.lg,
  },
  decisionActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  submitBtn: {
    flex: 2,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnReject: {
    backgroundColor: Colors.error,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: '#fff',
  },
  decidedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: 4,
  },
  decidedStatusText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
  },
});
