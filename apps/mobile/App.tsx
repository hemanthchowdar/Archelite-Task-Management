import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar,
  TextInput
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

// Translation database for MVP demo
const translations: Record<string, Record<string, string>> = {
  en: {
    title: "Tasks",
    search: "Search tasks...",
    all: "All",
    todo: "To-Do",
    in_progress: "In Progress",
    verification: "Verification",
    priority: "Priority",
    due: "Due"
  },
  hi: {
    title: "कार्य",
    search: "कार्य खोजें...",
    all: "सभी",
    todo: "करने योग्य",
    in_progress: "प्रगति पर",
    verification: "सत्यापन",
    priority: "प्राथमिकता",
    due: "तिथि"
  },
  te: {
    title: "పనులు",
    search: "పనుల శోధన...",
    all: "అన్నీ",
    todo: "చేయవలసినవి",
    in_progress: "ప్రగతిలో ఉంది",
    verification: "ధృవీకరణ",
    priority: "ప్రాధాన్యత",
    due: "గడువు"
  }
};

interface TaskItem {
  id: string;
  title: string;
  lastMessage: string;
  time: string;
  priority: 'low' | 'medium' | 'high' | 'critical' | 'urgent';
  status: 'todo' | 'in_progress' | 'verification' | 'closed';
  site: string;
}

export default function App() {
  const [lang, setLang] = useState<'en' | 'hi' | 'te'>('en');
  const [activeFilter, setActiveFilter] = useState<'all' | 'todo' | 'in_progress' | 'verification'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const t = translations[lang];

  const mockTasks: TaskItem[] = [
    { id: '1', title: 'Verify Concrete Pour at Site A', lastMessage: 'Contractor: Ready for inspection. Waiting on engineer sign-off.', time: '10:04 AM', priority: 'high', status: 'verification', site: 'Metro Station' },
    { id: '2', title: 'Submit Bookkeeping Q2 Invoice', lastMessage: 'Accounts: Invoices uploaded to S3. Reviewing now.', time: 'Yesterday', priority: 'medium', status: 'in_progress', site: 'HQ' },
    { id: '3', title: 'Re-routing Electrical Piping Ground Floor', lastMessage: 'Electrician: Need clarification on architectural drawing.', time: '14 Jun', priority: 'critical', status: 'todo', site: 'Residential Complex' },
    { id: '4', title: 'Excavator fuel billing dispute', lastMessage: 'Manager: Settled the discrepancy with supplier.', time: '10 Jun', priority: 'low', status: 'closed', site: 'Highway Project' }
  ];

  const getPriorityColor = (p: TaskItem['priority']) => {
    switch(p) {
      case 'urgent':
      case 'critical': return '#f43f5e'; // rose-500
      case 'high': return '#f59e0b'; // amber-500
      case 'medium': return '#3b82f6'; // blue-500
      default: return '#94a3b8'; // slate-400
    }
  };

  const filteredTasks = mockTasks.filter(task => {
    const matchesFilter = activeFilter === 'all' || task.status === activeFilter;
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          task.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          task.site.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" />
      
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.title}</Text>
        
        {/* Language Switches */}
        <View style={styles.langContainer}>
          {(['en', 'hi', 'te'] as const).map(l => (
            <TouchableOpacity 
              key={l} 
              style={[styles.langBtn, lang === l && styles.langBtnActive]} 
              onPress={() => setLang(l)}
            >
              <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                {l === 'en' ? 'EN' : l === 'hi' ? 'हिंदी' : 'తెలుగు'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <TextInput 
          style={styles.searchInput}
          placeholder={t.search}
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        {(['all', 'todo', 'in_progress', 'verification'] as const).map(filter => (
          <TouchableOpacity
            key={filter}
            style={[styles.chip, activeFilter === filter && styles.chipActive]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text style={[styles.chipText, activeFilter === filter && styles.chipTextActive]}>
              {t[filter]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task List (WhatsApp-style Threads) */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.taskCard}>
            {/* Left Priority Indicator */}
            <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
            
            <View style={styles.taskDetails}>
              <View style={styles.taskMetaRow}>
                <Text style={styles.siteText}>{item.site}</Text>
                <Text style={styles.timeText}>{item.time}</Text>
              </View>
              
              <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.messageText} numberOfLines={2}>{item.lastMessage}</Text>
              
              <View style={styles.badgeRow}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{t[item.status] || item.status}</Text>
                </View>
                <Text style={styles.priorityLabel}>{t.priority}: {item.priority.toUpperCase()}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#040814',
    paddingTop: StatusBar.currentHeight || 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    flex: 1,
  },
  langContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  langBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#1e293b',
  },
  langBtnActive: {
    backgroundColor: '#3b82f6',
  },
  langText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  langTextActive: {
    color: '#ffffff',
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: {
    height: 40,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  chipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  taskCard: {
    flexDirection: 'row',
    backgroundColor: '#0b1329',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  priorityDot: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  taskDetails: {
    flex: 1,
    gap: 4,
  },
  taskMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  siteText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  timeText: {
    color: '#64748b',
    fontSize: 11,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  messageText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
  },
  statusBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '700',
  },
  priorityLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  }
});
