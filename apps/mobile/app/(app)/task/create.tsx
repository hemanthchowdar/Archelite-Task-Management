import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';

type Priority = 'low' | 'medium' | 'high' | 'critical' | 'urgent';
type Category = 'accounting' | 'bookkeeping' | 'construction' | 'invoice';

const PRIORITIES: {
  key: Priority;
  dotColor: string;
}[] = [
  { key: 'low', dotColor: Colors.low },
  { key: 'medium', dotColor: Colors.medium },
  { key: 'high', dotColor: Colors.high },
  { key: 'critical', dotColor: Colors.critical },
  { key: 'urgent', dotColor: Colors.urgent },
];

const CATEGORIES: Category[] = [
  'accounting',
  'bookkeeping',
  'construction',
  'invoice',
];

export default function CreateTaskScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [priority, setPriority] = useState<Priority>('high');
  const [category, setCategory] = useState<Category>('accounting');
  const [description, setDescription] = useState('');
  const [dueDate] = useState('Fri, 18 Oct');

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ──────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('tasks.newTask')}</Text>
        <TouchableOpacity>
          <Ionicons
            name="ellipsis-vertical"
            size={22}
            color={Colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Priority ──────────────────────── */}
        <Text style={styles.sectionLabel}>{t('tasks.priority')}</Text>
        <View style={styles.chipGrid}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.priorityChip,
                priority === p.key && styles.priorityChipActive,
              ]}
              onPress={() => setPriority(p.key)}
            >
              <View
                style={[
                  styles.priorityDot,
                  { backgroundColor: p.dotColor },
                  priority === p.key && p.key === 'high' && { backgroundColor: '#fff' },
                ]}
              />
              <Text
                style={[
                  styles.priorityText,
                  priority === p.key && styles.priorityTextActive,
                ]}
              >
                {t(`tasks.${p.key}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Due Date ──────────────────────── */}
        <Text style={styles.sectionLabel}>{t('tasks.dueDate')}</Text>
        <TouchableOpacity style={styles.dateInput}>
          <Text style={styles.dateText}>{dueDate}</Text>
          <Ionicons
            name="calendar-outline"
            size={20}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>

        {/* ── Category ──────────────────────── */}
        <Text style={styles.sectionLabel}>{t('tasks.category')}</Text>
        <View style={styles.chipGrid}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.categoryChip,
                category === c && styles.categoryChipActive,
              ]}
              onPress={() => setCategory(c)}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === c && styles.categoryTextActive,
                ]}
              >
                {t(`tasks.${c}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Description ───────────────────── */}
        <Text style={styles.sectionLabel}>{t('tasks.description')}</Text>
        <TextInput
          style={styles.descriptionInput}
          placeholder={t('tasks.descriptionPlaceholder')}
          placeholderTextColor={Colors.textMuted}
          multiline
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
        />

        {/* ── Attachment area ────────────────── */}
        <View style={styles.attachRow}>
          <TouchableOpacity style={styles.attachBox}>
            <Ionicons
              name="camera-outline"
              size={24}
              color={Colors.textMuted}
            />
            <Text style={styles.attachLabel}>{t('tasks.photo')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachBox}>
            <Ionicons
              name="document-outline"
              size={24}
              color={Colors.textMuted}
            />
            <Text style={styles.attachLabel}>{t('tasks.document')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Bottom CTA ──────────────────────── */}
      <View style={styles.bottomCTA}>
        <TouchableOpacity
          style={styles.createButton}
          activeOpacity={0.85}
          onPress={() => router.back()}
        >
          <Text style={styles.createButtonText}>{t('tasks.createTask')}</Text>
          <Ionicons name="arrow-forward" size={20} color={Colors.textOnPrimary} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 120,
  },
  // ── Section Label ───────
  sectionLabel: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    marginTop: Spacing.xl,
  },
  // ── Priority Chips ──────
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  priorityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  priorityChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  priorityTextActive: {
    color: Colors.textOnPrimary,
    fontWeight: '700',
  },
  // ── Date ────────────────
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  dateText: {
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
  },
  // ── Category Chips ──────
  categoryChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  categoryChipActive: {
    backgroundColor: Colors.header,
    borderColor: Colors.header,
  },
  categoryText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  categoryTextActive: {
    color: Colors.headerText,
    fontWeight: '700',
  },
  // ── Description ─────────
  descriptionInput: {
    minHeight: 100,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  // ── Attachments ─────────
  attachRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.xxl,
  },
  attachBox: {
    flex: 1,
    height: 80,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  attachLabel: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  // ── Bottom CTA ──────────
  bottomCTA: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.background,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  createButtonText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    letterSpacing: 0.5,
  },
});
