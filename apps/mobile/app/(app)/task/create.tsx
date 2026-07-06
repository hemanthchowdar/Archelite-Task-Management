import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Colors, Fonts, Spacing, Radius } from '@/constants/theme';
import { apiFetch } from '@/api/queryClient';
import { useAppStore } from '@/store/useAppStore';

// ── Types ──────────────────────────────────────────────
type Priority = 'low' | 'medium' | 'high' | 'critical' | 'urgent';

interface Category {
  id: string;
  key: string;
  labelEn: string;
}

interface EmployeeResult {
  id: string;
  name: string;
  phone: string;
  email?: string;
  employeeId?: string;
}

interface EmployeeListResponse {
  data: EmployeeResult[];
}

interface SelectedAssignee {
  id: string;
  name: string;
}

// ── Priority config ────────────────────────────────────
const PRIORITIES: { key: Priority; dotColor: string }[] = [
  { key: 'low', dotColor: Colors.low },
  { key: 'medium', dotColor: Colors.medium },
  { key: 'high', dotColor: Colors.high },
  { key: 'critical', dotColor: Colors.critical },
  { key: 'urgent', dotColor: Colors.urgent },
];

// ── Helper: format date for display ───────────────────
function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ── Main Screen ────────────────────────────────────────
export default function CreateTaskScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const actor = useAppStore((s) => s.employee);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('high');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<SelectedAssignee[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  // Date picker state
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Attachment state
  const [attachments, setAttachments] = useState<{
    fileUrl: string;
    fileName: string;
    fileType: string;
    sizeBytes: number;
  }[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // ── Fetch categories from API ──────────────────────
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['task-categories'],
    queryFn: () => apiFetch<Category[]>('/tasks/categories'),
  });

  // ── Search employees (debounced by query length check) ──
  const { data: employeeResults, isFetching: isSearching } = useQuery<EmployeeListResponse>({
    queryKey: ['employees-search', assigneeSearch],
    queryFn: () =>
      apiFetch<EmployeeListResponse>(`/employees?search=${encodeURIComponent(assigneeSearch)}&limit=10`),
    enabled: assigneeSearch.trim().length >= 2,
  });

  const searchResults = employeeResults?.data ?? [];

  // ── Create task mutation ───────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      description?: string;
      priority: Priority;
      dueDate?: string;
      categoryId?: string;
      assigneeIds: string[];
      attachments?: {
        fileUrl: string;
        fileName: string;
        fileType: string;
        sizeBytes: number;
      }[];
    }) =>
      apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      router.back();
    },
    onError: (err: Error) => {
      Alert.alert('Create Failed', err.message);
    },
  });

  // ── Handlers ──────────────────────────────────────
  const addAssignee = useCallback((emp: EmployeeResult) => {
    if (!selectedAssignees.some((a) => a.id === emp.id)) {
      setSelectedAssignees((prev) => [...prev, { id: emp.id, name: emp.name }]);
    }
    setAssigneeSearch('');
    setShowAssigneeDropdown(false);
  }, [selectedAssignees]);

  const removeAssignee = useCallback((id: string) => {
    setSelectedAssignees((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const onDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

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

      setAttachments((prev) => [...prev, response]);
      Alert.alert('Upload Successful', `File "${fileName}" uploaded successfully.`);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'An error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((att) => att.fileUrl !== url));
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
      console.log('Document picking cancelled or failed', err);
    }
  };

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Validation Error', 'Task title is required.');
      return;
    }
    if (selectedAssignees.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one assignee.');
      return;
    }

    createMutation.mutate({
      title: trimmedTitle,
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate ? dueDate.toISOString() : undefined,
      categoryId: selectedCategory?.id ?? undefined,
      assigneeIds: selectedAssignees.map((a) => a.id),
      attachments,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ──────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('tasks.newTask')}</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={createMutation.isPending}>
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.headerSaveBtn}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Task Title (autoFocus) ─────────── */}
        <Text style={styles.sectionLabel}>
          {t('tasks.title') ?? 'Task Title'}
          <Text style={styles.required}> *</Text>
        </Text>
        <TextInput
          style={styles.titleInput}
          placeholder="e.g. Submit GST filing for Q3"
          placeholderTextColor={Colors.textMuted}
          value={title}
          onChangeText={setTitle}
          autoFocus
          returnKeyType="next"
          maxLength={200}
        />

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
                  priority === p.key && { backgroundColor: '#fff' },
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
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={[styles.dateText, !dueDate && styles.datePlaceholder]}>
            {dueDate ? formatDateDisplay(dueDate) : 'Select due date (optional)'}
          </Text>
          <View style={styles.dateActions}>
            {dueDate && (
              <TouchableOpacity
                onPress={() => setDueDate(null)}
                style={styles.clearDateBtn}
              >
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
            <Ionicons name="calendar-outline" size={20} color={Colors.textSecondary} />
          </View>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={dueDate ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={onDateChange}
          />
        )}

        {/* ── Category ──────────────────────── */}
        <Text style={styles.sectionLabel}>{t('tasks.category')}</Text>
        {categories.length === 0 ? (
          <Text style={styles.emptyNote}>Loading categories…</Text>
        ) : (
          <View style={styles.chipGrid}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.categoryChip,
                  selectedCategory?.id === c.id && styles.categoryChipActive,
                ]}
                onPress={() =>
                  setSelectedCategory((prev) =>
                    prev?.id === c.id ? null : c
                  )
                }
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory?.id === c.id && styles.categoryTextActive,
                  ]}
                >
                  {c.labelEn}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Assignee Picker ───────────────── */}
        <Text style={styles.sectionLabel}>
          Assignees
          <Text style={styles.required}> *</Text>
        </Text>

        {/* Selected assignees chips */}
        {selectedAssignees.length > 0 && (
          <View style={styles.selectedAssignees}>
            {selectedAssignees.map((a, index) => (
              <View key={a.id} style={styles.assigneeChip}>
                <View style={styles.assigneeChipAvatar}>
                  <Text style={styles.assigneeChipAvatarText}>
                    {a.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.assigneeChipName}>
                  {a.name}
                  {index === 0 && (
                    <Text style={styles.assigneeChipRole}> (Owner)</Text>
                  )}
                </Text>
                <TouchableOpacity onPress={() => removeAssignee(a.id)}>
                  <Ionicons name="close" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Search input */}
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employees by name or phone…"
            placeholderTextColor={Colors.textMuted}
            value={assigneeSearch}
            onChangeText={(text) => {
              setAssigneeSearch(text);
              setShowAssigneeDropdown(text.trim().length >= 2);
            }}
            returnKeyType="search"
          />
          {isSearching && (
            <ActivityIndicator size="small" color={Colors.primary} style={styles.searchSpinner} />
          )}
        </View>

        {/* Dropdown results */}
        {showAssigneeDropdown && searchResults.length > 0 && (
          <View style={styles.dropdown}>
            {searchResults.map((emp) => {
              const alreadySelected = selectedAssignees.some((a) => a.id === emp.id);
              return (
                <TouchableOpacity
                  key={emp.id}
                  style={[styles.dropdownItem, alreadySelected && styles.dropdownItemSelected]}
                  onPress={() => !alreadySelected && addAssignee(emp)}
                  disabled={alreadySelected}
                >
                  <View style={styles.dropdownAvatar}>
                    <Text style={styles.dropdownAvatarText}>
                      {emp.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.dropdownInfo}>
                    <Text style={styles.dropdownName}>{emp.name}</Text>
                    <Text style={styles.dropdownSub}>
                      {emp.phone}{emp.email ? ` · ${emp.email}` : ''}
                    </Text>
                  </View>
                  {alreadySelected && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {showAssigneeDropdown && assigneeSearch.trim().length >= 2 && searchResults.length === 0 && !isSearching && (
          <Text style={styles.emptyNote}>No employees found for "{assigneeSearch}"</Text>
        )}

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

        {/* ── Uploaded attachments list ── */}
        {attachments.length > 0 && (
          <View style={styles.uploadedAttachmentsContainer}>
            <Text style={styles.sectionLabel}>Uploaded Files</Text>
            {attachments.map((att) => (
              <View key={att.fileUrl} style={styles.uploadedAttachmentRow}>
                <Ionicons
                  name={att.fileType.startsWith('image/') ? 'image-outline' : 'document-outline'}
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.uploadedAttachmentName} numberOfLines={1}>
                  {att.fileName}
                </Text>
                <TouchableOpacity onPress={() => removeAttachment(att.fileUrl)}>
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── Attachment area ──── */}
        <View style={styles.attachRow}>
          <TouchableOpacity
            style={[styles.attachBox, isUploading && { opacity: 0.5 }]}
            onPress={handlePickPhoto}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={24} color={Colors.textSecondary} />
                <Text style={styles.attachLabel}>{t('tasks.photo') || 'Photo'}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.attachBox, isUploading && { opacity: 0.5 }]}
            onPress={handlePickDocument}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <>
                <Ionicons name="document-outline" size={24} color={Colors.textSecondary} />
                <Text style={styles.attachLabel}>{t('tasks.document') || 'Document'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Bottom CTA ──────────────────────── */}
      <View style={styles.bottomCTA}>
        <TouchableOpacity
          style={[
            styles.createButton,
            createMutation.isPending && styles.createButtonDisabled,
          ]}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color={Colors.textOnPrimary} />
          ) : (
            <>
              <Text style={styles.createButtonText}>{t('tasks.createTask')}</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.textOnPrimary} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────
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
  headerSaveBtn: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: Colors.primary,
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
  required: {
    color: Colors.error,
  },
  emptyNote: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  // ── Title Input ─────────
  titleInput: {
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
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
    flex: 1,
  },
  datePlaceholder: {
    color: Colors.textMuted,
  },
  dateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  clearDateBtn: {
    padding: 2,
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
  // ── Assignee Chips ───────
  selectedAssignees: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.xs,
    paddingRight: Spacing.sm,
    borderWidth: 1,
    borderColor: `${Colors.primary}40`,
  },
  assigneeChipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigneeChipAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  assigneeChipName: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  assigneeChipRole: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '400',
    color: Colors.textMuted,
  },
  // ── Search ──────────────
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
    height: '100%',
  },
  searchSpinner: {
    flexShrink: 0,
  },
  // ── Dropdown ────────────
  dropdown: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownItemSelected: {
    backgroundColor: Colors.surfaceMuted,
  },
  dropdownAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownAvatarText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: '#fff',
  },
  dropdownInfo: {
    flex: 1,
  },
  dropdownName: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dropdownSub: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
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
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
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
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  uploadedAttachmentsContainer: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  uploadedAttachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  uploadedAttachmentName: {
    fontSize: Fonts.sizes.md,
    fontWeight: '500',
    color: Colors.textPrimary,
    flex: 1,
    marginLeft: Spacing.sm,
    marginRight: Spacing.md,
  },
});
