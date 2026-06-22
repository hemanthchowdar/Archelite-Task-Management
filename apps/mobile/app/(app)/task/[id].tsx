import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, Radius, avatarColor } from '@/constants/theme';

// ── Mock Thread Data ──────────────────────────────────
const MOCK_DETAIL = {
  title: 'Approve cement vendor',
  status: 'NEEDS VERIFICATION',
  priority: 'Urgent',
  dueDate: 'Due Fri, 18 Oct',
  assignees: ['P', 'R'],
  messages: [
    {
      id: '1',
      sender: 'Ramesh',
      text: 'Please process this before Friday.\nInvoice attached.',
      time: '9:58',
      isMine: false,
    },
    {
      id: '2',
      sender: null,
      type: 'file',
      fileName: 'Invoice_Oct.pdf',
      fileSize: '240 KB • PDF',
      isMine: false,
    },
    {
      id: '3',
      sender: null,
      text: 'Amount matches the PO.\nRequesting your approval.',
      time: '10:22',
      isMine: true,
    },
    {
      id: '4',
      sender: null,
      type: 'system',
      text: 'Priya marked this Needs verification',
    },
    {
      id: '5',
      sender: null,
      type: 'approval',
      title: 'Approval requested',
      subtitle: 'from Ramesh • Director',
    },
  ],
};

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ──────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.headerText} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {MOCK_DETAIL.title}
          </Text>
          <Text style={styles.headerSubtitle}>{MOCK_DETAIL.status}</Text>
        </View>
        <TouchableOpacity>
          <Ionicons
            name="ellipsis-vertical"
            size={22}
            color={Colors.headerText}
          />
        </TouchableOpacity>
      </View>

      {/* ── Meta chips ──────────────────────── */}
      <View style={styles.metaRow}>
        <View style={styles.urgentChip}>
          <View style={styles.urgentDot} />
          <Text style={styles.urgentText}>{MOCK_DETAIL.priority}</Text>
        </View>
        <View style={styles.dateChip}>
          <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.dateText}>{MOCK_DETAIL.dueDate}</Text>
        </View>
        <View style={styles.assigneeRow}>
          {MOCK_DETAIL.assignees.map((a, i) => (
            <View
              key={a}
              style={[
                styles.assigneeAvatar,
                { backgroundColor: avatarColor(a), marginLeft: i > 0 ? -8 : 0 },
              ]}
            >
              <Text style={styles.assigneeText}>{a}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Messages Thread ─────────────────── */}
      <ScrollView
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        showsVerticalScrollIndicator={false}
      >
        {MOCK_DETAIL.messages.map((msg) => {
          // System message
          if (msg.type === 'system') {
            return (
              <View key={msg.id} style={styles.systemRow}>
                <Text style={styles.systemText}>{msg.text}</Text>
              </View>
            );
          }

          // Approval card
          if (msg.type === 'approval') {
            return (
              <View key={msg.id} style={styles.approvalCard}>
                <View style={styles.approvalIcon}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={24}
                    color={Colors.primary}
                  />
                </View>
                <View style={styles.approvalContent}>
                  <Text style={styles.approvalTitle}>{msg.title}</Text>
                  <Text style={styles.approvalSubtitle}>{msg.subtitle}</Text>
                </View>
                <View style={styles.approvalActions}>
                  <TouchableOpacity style={styles.approvalActionBtn}>
                    <Ionicons name="checkmark" size={16} color={Colors.success} />
                    <Text style={[styles.approvalActionText, { color: Colors.success }]}>
                      {t('approvals.approve')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.approvalActionBtn}>
                    <Ionicons name="close" size={16} color={Colors.textSecondary} />
                    <Text style={styles.approvalActionText}>
                      {t('approvals.reject')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }

          // File attachment
          if (msg.type === 'file') {
            return (
              <View key={msg.id} style={styles.fileBubble}>
                <Ionicons
                  name="document-text"
                  size={24}
                  color={Colors.urgent}
                />
                <View>
                  <Text style={styles.fileName}>{msg.fileName}</Text>
                  <Text style={styles.fileMeta}>{msg.fileSize}</Text>
                </View>
              </View>
            );
          }

          // Normal message
          return (
            <View key={msg.id}>
              {msg.sender && (
                <Text style={styles.senderName}>{msg.sender}</Text>
              )}
              <View
                style={[
                  styles.bubble,
                  msg.isMine ? styles.bubbleMine : styles.bubbleOther,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    msg.isMine && styles.bubbleTextMine,
                  ]}
                >
                  {msg.text}
                </Text>
                {msg.time && (
                  <Text
                    style={[
                      styles.bubbleTime,
                      msg.isMine && styles.bubbleTimeMine,
                    ]}
                  >
                    {msg.time}
                    {msg.isMine && ' ✓✓'}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* ── Composer ────────────────────────── */}
      <View style={styles.composer}>
        <TouchableOpacity style={styles.composerIcon}>
          <Ionicons name="attach" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.composerIcon}>
          <Ionicons name="camera-outline" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
        <TextInput
          style={styles.composerInput}
          placeholder={t('tasks.message')}
          placeholderTextColor={Colors.textMuted}
        />
      </View>
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
  headerSubtitle: {
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
  },
  urgentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEBEE',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  urgentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.urgent,
  },
  urgentText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
    color: Colors.urgent,
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
  // ── File ────────────────
  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    alignSelf: 'flex-start',
    maxWidth: '80%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  fileName: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  fileMeta: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
  },
  // ── System ──────────────
  systemRow: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  systemText: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    overflow: 'hidden',
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
  approvalIcon: {
    marginBottom: Spacing.sm,
  },
  approvalContent: {
    marginBottom: Spacing.md,
  },
  approvalTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  approvalSubtitle: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
  },
  approvalActions: {
    flexDirection: 'row',
    gap: Spacing.xxl,
  },
  approvalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  approvalActionText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  // ── Composer ────────────
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  composerIcon: {
    padding: 4,
  },
  composerInput: {
    flex: 1,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceMuted,
  },
});
