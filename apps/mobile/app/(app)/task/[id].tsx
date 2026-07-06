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
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

interface TaskAssignment {
  id: string;
  employeeId: string;
  role: string;
  employee: Employee;
}

interface ApprovalRequest {
  id: string;
  taskId: string;
  requestedById: string;
  approverId: string;
  status: 'pending' | 'approved' | 'rejected';
  decisionComment?: string;
  createdAt: string;
  decidedAt?: string;
  requestedBy: Employee;
  approver: Employee;
}

interface AuditLog {
  id: string;
  action: string;
  fromValue?: string;
  toValue?: string;
  createdAt: string;
  actor: Employee;
}

interface Attachment {
  id: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  createdAt: string;
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: Employee;
  attachments?: Attachment[];
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  category?: { id: string; key: string; labelEn: string };
  project?: { id: string; name: string };
  createdBy: Employee;
  assignments: TaskAssignment[];
  approvals: ApprovalRequest[];
  auditLogs: AuditLog[];
  comments: Comment[];
}

// ── Valid state transitions (mirrors backend) ──────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  todo: ['in_progress'],
  in_progress: ['needs_action', 'needs_verification', 'closed'],
  needs_action: ['in_progress'],
  needs_verification: ['closed', 'needs_action', 'in_progress'],
  closed: ['in_progress', 'todo'],
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  needs_action: 'Needs Action',
  needs_verification: 'Needs Verification',
  closed: 'Closed',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: Colors.urgent,
  critical: Colors.critical,
  high: Colors.high,
  medium: Colors.medium,
  low: Colors.low,
};

// ── Helper: format relative time ──────────────────────
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

// ── Main Screen ────────────────────────────────────────
export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const actor = useAppStore((s) => s.employee);
  const insets = useSafeAreaInsets();

  // UI state
  const [statusPickerVisible, setStatusPickerVisible] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);
  const [approvalDecision, setApprovalDecision] = useState<'approved' | 'rejected' | null>(null);
  const [approvalComment, setApprovalComment] = useState('');

  // Request approval picker state
  const [requestApprovalVisible, setRequestApprovalVisible] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedApprover, setSelectedApprover] = useState<Employee | null>(null);

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<Array<{ fileUrl: string, fileName: string, fileType: string, sizeBytes: number }>>([]);
  const [isUploading, setIsUploading] = useState(false);


  // ── Comment functions ─────────────────────────────
  const uploadFile = async (uri: string, fileName: string, mimeType: string) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: fileName,
        type: mimeType,
      } as any);

      const response = await apiFetch<{
        fileUrl: string;
        fileName: string;
        fileType: string;
        sizeBytes: number;
      }>('/tasks/attachments/upload', {
        method: 'POST',
        body: formData,
      });

      setCommentAttachments((prev) => [...prev, response]);
      Alert.alert('Upload Successful', `File "${fileName}" uploaded successfully.`);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'An error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (url: string) => {
    setCommentAttachments((prev) => prev.filter((att) => att.fileUrl !== url));
  };

  const handlePickPhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Camera access is required to take photos.');
      return;
    }

    Alert.alert(
      'Upload Photo',
      'Choose photo source',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              const asset = result.assets[0];
              uploadFile(asset.uri, asset.fileName || 'photo.jpg', 'image/jpeg');
            }
          },
        },
        {
          text: 'Library',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              const asset = result.assets[0];
              uploadFile(asset.uri, asset.fileName || 'photo.jpg', 'image/jpeg');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        uploadFile(asset.uri, asset.name, asset.mimeType || 'application/octet-stream');
      }
    } catch (err) {
      console.log('Document picking error:', err);
    }
  };

  const commentMutation = useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/tasks/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          body,
          type: 'text',
          attachments: commentAttachments,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      setCommentText('');
      setCommentAttachments([]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => {
      Alert.alert('Send Failed', err.message);
    },
  });

  const sendComment = () => {
    if (!commentText.trim() && commentAttachments.length === 0) return;
    commentMutation.mutate(commentText.trim());
  };

  // ── Fetch task details ─────────────────────────────
  const {
    data: task,
    isLoading,
    isError,
    refetch,
  } = useQuery<Task>({
    queryKey: ['task', id],
    queryFn: () => apiFetch<Task>(`/tasks/${id}`),
    enabled: !!id,
    refetchInterval: 2000,
  });

  // ── Mutation: status transition ────────────────────
  const statusMutation = useMutation({
    mutationFn: (newStatus: string) =>
      apiFetch(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatusPickerVisible(false);
    },
    onError: (err: Error) => {
      Alert.alert('Status Update Failed', err.message);
    },
  });

  // ── Query: employee list for approver picker ───────
  const { data: employeesData } = useQuery<{ data: Employee[] }>({
    queryKey: ['employees', employeeSearch],
    queryFn: () =>
      apiFetch<{ data: Employee[] }>(
        `/employees?limit=30${employeeSearch.trim() ? `&search=${encodeURIComponent(employeeSearch.trim())}` : ''}`
      ),
    enabled: requestApprovalVisible,
  });
  const employees = employeesData?.data ?? [];

  // ── Mutation: request approval ─────────────────────
  const requestApprovalMutation = useMutation({
    mutationFn: (approverId: string) =>
      apiFetch(`/tasks/${id}/approvals`, {
        method: 'POST',
        body: JSON.stringify({ approverId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRequestApprovalVisible(false);
      setSelectedApprover(null);
      setEmployeeSearch('');
      Alert.alert('Approval Requested', `Approval request sent to ${selectedApprover?.name}.`);
    },
    onError: (err: Error) => {
      Alert.alert('Request Failed', err.message);
    },
  });

  // ── Mutation: decide on approval ───────────────────
  const approvalMutation = useMutation({
    mutationFn: ({
      approvalId,
      status,
      decisionComment,
    }: {
      approvalId: string;
      status: 'approved' | 'rejected';
      decisionComment: string;
    }) =>
      apiFetch(`/tasks/${id}/approvals/${approvalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, decisionComment }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setApprovalModalVisible(false);
      setApprovalComment('');
      setPendingApproval(null);
      setApprovalDecision(null);
    },
    onError: (err: Error) => {
      Alert.alert('Approval Failed', err.message);
    },
  });

  const openApprovalModal = (
    approval: ApprovalRequest,
    decision: 'approved' | 'rejected'
  ) => {
    setPendingApproval(approval);
    setApprovalDecision(decision);
    setApprovalComment('');
    setApprovalModalVisible(true);
  };

  const submitApproval = () => {
    if (!pendingApproval || !approvalDecision) return;
    if (!approvalComment.trim()) {
      Alert.alert('Comment Required', 'Please enter a decision comment before submitting.');
      return;
    }
    approvalMutation.mutate({
      approvalId: pendingApproval.id,
      status: approvalDecision,
      decisionComment: approvalComment.trim(),
    });
  };

  // ── Mutation: delete task ──────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/tasks/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Deleted', 'Task has been deleted successfully.', [
        { text: 'OK', onPress: () => router.replace('/tasks') }
      ]);
    },
    onError: (err: Error) => {
      Alert.alert('Delete Failed', err.message);
    },
  });

  // ── Loading / Error states ─────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !task) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.centerText}>Could not load task</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pendingApprovals = task.approvals.filter((a) => a.status === 'pending');
  const allowedNextStatuses = VALID_TRANSITIONS[task.status] ?? [];

  const confirmDeleteTask = () => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to permanently delete this task? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  const handleOpenMenu = () => {
    const isSuperAdmin = actor?.role === 'SUPER_ADMIN';
    const isAdmin = actor?.role === 'ADMIN';
    const isCreator = task.createdBy.id === actor?.id;
    const canDelete = isSuperAdmin || isAdmin || isCreator;

    Alert.alert(
      'Task Options',
      'Choose an action to perform',
      [
        {
          text: 'Request Approval',
          onPress: () => setRequestApprovalVisible(true),
        },
        ...(canDelete
          ? [
              {
                text: 'Delete Task',
                style: 'destructive' as const,
                onPress: confirmDeleteTask,
              },
            ]
          : []),
        {
          text: 'Cancel',
          style: 'cancel' as const,
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* ── Header ──────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.headerText} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {task.title}
            </Text>
            {/* Tappable status chip ─ opens picker */}
            <TouchableOpacity
              style={styles.headerStatusChip}
              onPress={() => allowedNextStatuses.length > 0 && setStatusPickerVisible(true)}
            >
              <Text style={styles.headerStatusText}>
                {STATUS_LABELS[task.status] ?? task.status}
              </Text>
              {allowedNextStatuses.length > 0 && (
                <Ionicons name="chevron-down" size={12} color={Colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleOpenMenu}>
            <Ionicons
              name="ellipsis-vertical"
              size={22}
              color={Colors.headerText}
            />
          </TouchableOpacity>
        </View>

        {/* ── Meta chips ──────────────────────── */}
        <View style={styles.metaRow}>
          {/* Priority */}
          <View
            style={[
              styles.priorityChip,
              { backgroundColor: `${PRIORITY_COLORS[task.priority] ?? Colors.medium}20` },
            ]}
          >
            <View
              style={[
                styles.priorityDot,
                { backgroundColor: PRIORITY_COLORS[task.priority] ?? Colors.medium },
              ]}
            />
            <Text
              style={[
                styles.priorityText,
                { color: PRIORITY_COLORS[task.priority] ?? Colors.medium },
              ]}
            >
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </Text>
          </View>

          {/* Due date */}
          {task.dueDate && (
            <View style={styles.dateChip}>
              <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.dateText}>
                {new Date(task.dueDate).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
            </View>
          )}

          {/* Assignee avatars */}
          <View style={styles.assigneeRow}>
            {task.assignments.slice(0, 4).map((a, i) => (
              <View
                key={a.id}
                style={[
                  styles.assigneeAvatar,
                  {
                    backgroundColor: avatarColor(a.employee.name),
                    marginLeft: i > 0 ? -8 : 0,
                  },
                ]}
              >
                <Text style={styles.assigneeText}>
                  {a.employee.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            ))}
            {task.assignments.length > 4 && (
              <View style={[styles.assigneeAvatar, { marginLeft: -8, backgroundColor: Colors.border }]}>
                <Text style={[styles.assigneeText, { color: Colors.textSecondary }]}>
                  +{task.assignments.length - 4}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Thread + Composer ── */}
        <View style={{ flex: 1 }}>
          <ScrollView
            style={styles.thread}
            contentContainerStyle={styles.threadContent}
            showsVerticalScrollIndicator={false}
          >
          {/* Description */}
          {task.description && (
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionText}>{task.description}</Text>
            </View>
          )}

          {/* Pending Approval Cards */}
          {pendingApprovals.map((approval) => (
            <View key={approval.id} style={styles.approvalCard}>
              <View style={styles.approvalIconRow}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={24}
                  color={Colors.primary}
                />
                <Text style={styles.approvalTitle}>Approval Requested</Text>
              </View>
              <Text style={styles.approvalSubtitle}>
                from {approval.requestedBy.name} → {approval.approver.name}
              </Text>
              <Text style={styles.approvalTime}>{relativeTime(approval.createdAt)}</Text>

              {/* Only the designated approver can decide */}
              {actor?.id === approval.approverId && (
                <View style={styles.approvalActions}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => openApprovalModal(approval, 'rejected')}
                  >
                    <Ionicons name="close" size={16} color={Colors.textPrimary} />
                    <Text style={styles.rejectBtnText}>{t('approvals.reject')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => openApprovalModal(approval, 'approved')}
                  >
                    <Ionicons name="checkmark" size={16} color={Colors.textOnPrimary} />
                    <Text style={styles.approveBtnText}>{t('approvals.approve')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}

          {/* Decided Approvals */}
          {task.approvals
            .filter((a) => a.status !== 'pending')
            .map((approval) => (
              <View key={approval.id} style={styles.systemRow}>
                <Ionicons
                  name={approval.status === 'approved' ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={approval.status === 'approved' ? Colors.success : Colors.error}
                />
                <Text style={styles.systemText}>
                  {approval.approver.name}{' '}
                  {approval.status === 'approved' ? 'approved' : 'rejected'} ·{' '}
                  {approval.decisionComment}
                </Text>
              </View>
            ))}

          {/* Comments */}
          {task.comments.map((comment) => {
            const isMine = comment.author.id === actor?.id;
            return (
              <View key={comment.id}>
                {!isMine && (
                  <Text style={styles.senderName}>{comment.author.name}</Text>
                )}
                <View
                  style={[
                    styles.bubble,
                    isMine ? styles.bubbleMine : styles.bubbleOther,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      isMine && styles.bubbleTextMine,
                    ]}
                  >
                    {comment.body}
                  </Text>

                  {/* Comment Attachments */}
                  {comment.attachments && comment.attachments.length > 0 && (
                    <View style={styles.commentBubbleAttachments}>
                      {comment.attachments.map((att) => (
                        <TouchableOpacity
                          key={att.id}
                          style={styles.commentBubbleAttachmentCard}
                          onPress={() => {
                            Alert.alert('File Details', `Name: ${att.fileName}\nSize: ${(att.sizeBytes / 1024).toFixed(1)} KB`, [
                              { text: 'Open Link', onPress: () => {
                                Linking.openURL(att.fileUrl);
                              }},
                              { text: 'OK', style: 'cancel' }
                            ]);
                          }}
                        >
                          <Ionicons
                            name={att.fileType.startsWith('image/') ? 'image' : 'document'}
                            size={16}
                            color={isMine ? '#fff' : Colors.primary}
                          />
                          <Text
                            style={[
                              styles.commentBubbleAttachmentText,
                              { color: isMine ? '#fff' : Colors.textPrimary }
                            ]}
                            numberOfLines={1}
                          >
                            {att.fileName}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text
                    style={[
                      styles.bubbleTime,
                      isMine && styles.bubbleTimeMine,
                    ]}
                  >
                    {relativeTime(comment.createdAt)}
                    {isMine && ' ✓✓'}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Audit trail */}
          {/* Audit trail */}
          {task.auditLogs
            .filter((log) => log.action !== 'add_comment' && log.action !== 'add_comment_with_attachments')
            .map((log) => (
              <View key={log.id} style={styles.systemRow}>
                <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.systemText}>
                  {log.actor.name} · {log.action.replace(/_/g, ' ')}{' '}
                  {log.toValue ? `→ ${log.toValue}` : ''} · {relativeTime(log.createdAt)}
                </Text>
              </View>
            ))}
        </ScrollView>

        {/* ── Composer ── */}
        <View style={[styles.composerContainer, { paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 8 }]}>
          {/* Uploading indicator */}
          {isUploading && (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.uploadingText}>Uploading file...</Text>
            </View>
          )}

          {/* Selected Attachments List */}
          {commentAttachments.length > 0 && (
            <View style={styles.commentAttachmentsList}>
              {commentAttachments.map((att) => (
                <View key={att.fileUrl} style={styles.commentAttachmentCard}>
                  <Ionicons
                    name={att.fileType.startsWith('image/') ? 'image-outline' : 'document-outline'}
                    size={14}
                    color={Colors.primary}
                  />
                  <Text style={styles.commentAttachmentName} numberOfLines={1}>
                    {att.fileName}
                  </Text>
                  <TouchableOpacity onPress={() => removeAttachment(att.fileUrl)}>
                    <Ionicons name="close-circle" size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.composer}>
            <TouchableOpacity
              style={styles.composerIcon}
              onPress={handlePickDocument}
              disabled={isUploading}
            >
              <Ionicons name="attach" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.composerIcon}
              onPress={handlePickPhoto}
              disabled={isUploading}
            >
              <Ionicons name="camera-outline" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
            <TextInput
              style={styles.composerInput}
              placeholder={t('tasks.message')}
              placeholderTextColor={Colors.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!commentText.trim() && commentAttachments.length === 0) && styles.sendBtnDisabled,
              ]}
              onPress={sendComment}
              disabled={(!commentText.trim() && commentAttachments.length === 0) || commentMutation.isPending}
            >
              {commentMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name="send"
                  size={18}
                  color={(!commentText.trim() && commentAttachments.length === 0) ? Colors.textMuted : '#fff'}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
        </View>

        {/* ── Status Picker Modal ──────────────── */}
        <Modal
          visible={statusPickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setStatusPickerVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setStatusPickerVisible(false)}
          >
            <View style={styles.pickerSheet}>
              <Text style={styles.pickerTitle}>Move to…</Text>
              {allowedNextStatuses.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.pickerOption}
                  onPress={() => statusMutation.mutate(s)}
                  disabled={statusMutation.isPending}
                >
                  <Text style={styles.pickerOptionText}>{STATUS_LABELS[s]}</Text>
                  {statusMutation.isPending && (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.pickerCancel}
                onPress={() => setStatusPickerVisible(false)}
              >
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── Approval Decision Modal ──────────── */}
        <Modal
          visible={approvalModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setApprovalModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setApprovalModalVisible(false)}
          >
            <View style={styles.approvalSheet}>
              <Text style={styles.approvalSheetTitle}>
                {approvalDecision === 'approved' ? '✅ Approve Task' : '❌ Reject Task'}
              </Text>
              <Text style={styles.approvalSheetSubtitle}>
                A comment is required before submitting your decision.
              </Text>
              <TextInput
                style={styles.approvalCommentInput}
                placeholder="Enter your decision comment…"
                placeholderTextColor={Colors.textMuted}
                multiline
                value={approvalComment}
                onChangeText={setApprovalComment}
                autoFocus
              />
              <View style={styles.approvalSheetActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setApprovalModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor:
                        approvalDecision === 'approved' ? Colors.success : Colors.error,
                    },
                  ]}
                  onPress={submitApproval}
                  disabled={approvalMutation.isPending}
                >
                  {approvalMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {approvalDecision === 'approved' ? 'Approve' : 'Reject'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── Request Approval Modal ────────────── */}
        <Modal
          visible={requestApprovalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setRequestApprovalVisible(false);
            setSelectedApprover(null);
            setEmployeeSearch('');
          }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setRequestApprovalVisible(false);
              setSelectedApprover(null);
              setEmployeeSearch('');
            }}
          >
            <View style={styles.requestApprovalSheet}>
              {/* Sheet handle */}
              <View style={styles.sheetHandle} />

              <Text style={styles.requestApprovalTitle}>Request Approval</Text>
              <Text style={styles.requestApprovalSubtitle}>
                Choose who should approve this task
              </Text>

              {/* Search bar */}
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search employees..."
                  placeholderTextColor={Colors.textMuted}
                  value={employeeSearch}
                  onChangeText={setEmployeeSearch}
                  autoCorrect={false}
                />
                {employeeSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setEmployeeSearch('')}>
                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Employee list */}
              <ScrollView
                style={styles.employeeList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {employees.length === 0 ? (
                  <View style={styles.emptyEmployees}>
                    <Ionicons name="people-outline" size={32} color={Colors.textMuted} />
                    <Text style={styles.emptyEmployeesText}>No employees found</Text>
                  </View>
                ) : (
                  employees
                    .filter((e) => e.id !== actor?.id)
                    .map((emp) => {
                      const isSelected = selectedApprover?.id === emp.id;
                      return (
                        <TouchableOpacity
                          key={emp.id}
                          style={[
                            styles.employeeRow,
                            isSelected && styles.employeeRowSelected,
                          ]}
                          onPress={() => setSelectedApprover(isSelected ? null : emp)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.employeeAvatar,
                              { backgroundColor: avatarColor(emp.name) },
                            ]}
                          >
                            <Text style={styles.employeeAvatarText}>
                              {emp.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.employeeInfo}>
                            <Text style={styles.employeeName}>{emp.name}</Text>
                            {emp.email && (
                              <Text style={styles.employeeEmail} numberOfLines={1}>
                                {emp.email}
                              </Text>
                            )}
                          </View>
                          {isSelected && (
                            <Ionicons
                              name="checkmark-circle"
                              size={22}
                              color={Colors.primary}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })
                )}
              </ScrollView>

              {/* Send button */}
              <TouchableOpacity
                style={[
                  styles.sendApprovalBtn,
                  (!selectedApprover || requestApprovalMutation.isPending) &&
                    styles.sendApprovalBtnDisabled,
                ]}
                onPress={() => {
                  if (selectedApprover) {
                    requestApprovalMutation.mutate(selectedApprover.id);
                  }
                }}
                disabled={!selectedApprover || requestApprovalMutation.isPending}
              >
                {requestApprovalMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={18} color="#fff" />
                    <Text style={styles.sendApprovalBtnText}>
                      {selectedApprover
                        ? `Send to ${selectedApprover.name}`
                        : 'Select an approver'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  centerText: {
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
  // ── Header ──────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.header,
    gap: Spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.headerText,
  },
  headerStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  headerStatusText: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ── Meta ────────────────
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    flexWrap: 'wrap',
  },
  priorityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  dateText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  assigneeRow: {
    flexDirection: 'row',
    marginLeft: 'auto',
  },
  assigneeAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  assigneeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  // ── Thread ──────────────
  thread: {
    flex: 1,
  },
  threadContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  descriptionBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  descriptionText: {
    fontSize: Fonts.sizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  // ── Approval card ───────
  approvalCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginVertical: Spacing.md,
  },
  approvalIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  approvalTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  approvalSubtitle: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  approvalTime: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  approvalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  rejectBtnText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.success,
  },
  approveBtnText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  // ── System messages ──────
  systemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  systemText: {
    flex: 1,
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  // ── Chat bubbles ─────────
  senderName: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
    color: Colors.urgent,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primaryLight,
  },
  bubbleText: {
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: Colors.textPrimary,
  },
  bubbleTime: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  bubbleTimeMine: {
    color: Colors.textSecondary,
  },
  // ── Composer ────────────
  composerContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  composerIcon: {
    padding: 4,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceMuted,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: 'transparent',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceMuted,
    gap: Spacing.sm,
  },
  uploadingText: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
  },
  commentAttachmentsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  commentAttachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    gap: 6,
  },
  commentAttachmentName: {
    fontSize: 11,
    color: Colors.textPrimary,
    maxWidth: 120,
  },
  commentBubbleAttachments: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  commentBubbleAttachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    gap: Spacing.sm,
  },
  commentBubbleAttachmentText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '500',
    flex: 1,
  },
  // ── Modal Overlay ────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  // ── Status Picker Sheet ──
  pickerSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: 36,
  },
  pickerTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pickerOptionText: {
    fontSize: Fonts.sizes.lg,
    color: Colors.textPrimary,
  },
  pickerCancel: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.sm,
  },
  pickerCancelText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  // ── Approval Sheet ───────
  approvalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: 36,
    gap: Spacing.md,
  },
  approvalSheetTitle: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  approvalSheetSubtitle: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
  },
  approvalCommentInput: {
    minHeight: 100,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
    padding: Spacing.lg,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
  },
  approvalSheetActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
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
    color: Colors.textPrimary,
  },
  submitBtn: {
    flex: 2,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  // ── Request Approval Sheet ──────────────
  requestApprovalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '85%',
    marginTop: 'auto',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  requestApprovalTitle: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  requestApprovalSubtitle: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
    padding: 0,
  },
  employeeList: {
    maxHeight: 320,
    marginBottom: Spacing.lg,
  },
  emptyEmployees: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyEmployeesText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textMuted,
  },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    gap: Spacing.md,
    marginBottom: 4,
  },
  employeeRowSelected: {
    backgroundColor: `${Colors.primary}15`,
  },
  employeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeAvatarText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: '#fff',
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  employeeEmail: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sendApprovalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    gap: Spacing.sm,
  },
  sendApprovalBtnDisabled: {
    backgroundColor: Colors.border,
  },
  sendApprovalBtnText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: '#fff',
  },
});
