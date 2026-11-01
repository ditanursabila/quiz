<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Users, 
  HelpCircle, 
  Check, 
  Clock, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Save, 
  X, 
  Building2, 
  Calendar, 
  FileDown,
  Database,
  LogOut
} from 'lucide-vue-next'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { 
  getAllParticipants, 
  getQuestions, 
  saveQuestion, 
  deleteQuestion, 
  getParticipantResult, 
  gradeEssaySubmissions,
  getTodayDateString,
  formatIndonesianDate,
  getAvailableDates
} from '../lib/supabase'
import SupabaseConfigModal from '../components/SupabaseConfigModal.vue'

const router = useRouter()

const todayStr = getTodayDateString()
const selectedDate = ref(todayStr)
const availableDates = ref([todayStr])

const activeTab = ref('participants')
const participants = ref([])
const questions = ref([])
const isLoading = ref(true)
const searchQuery = ref('')
const filterStatus = ref('all')

const showSupabaseModal = ref(false)
const isExportingPdf = ref(false)

// State Modal Grading Essay
const showGradeModal = ref(false)
const selectedParticipant = ref(null)
const participantAnswers = ref([])
const gradingInputs = ref({})
const isSavingGrade = ref(false)

// State Modal Tambah / Edit Soal (Hanya opsi A, B, C)
const showQuestionModal = ref(false)
const isEditing = ref(false)
const questionForm = ref({
  id: null,
  quiz_date: todayStr,
  type: 'multiple_choice',
  question_text: '',
  options: [
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' }
  ],
  correct_answer: 'A',
  points: 25,
  order_num: 1
})
const isSavingQuestion = ref(false)

const loadData = async () => {
  isLoading.value = true
  try {
    const [pList, qList, dates] = await Promise.all([
      getAllParticipants(selectedDate.value),
      getQuestions(selectedDate.value),
      getAvailableDates()
    ])
    participants.value = pList
    questions.value = qList
    availableDates.value = dates
  } catch (err) {
    console.error('Error load admin data:', err)
  } finally {
    isLoading.value = false
  }
}

watch(selectedDate, () => {
  loadData()
})

onMounted(() => {
  if (!sessionStorage.getItem('admin_authenticated')) {
    router.replace('/login')
    return
  }
  loadData()
})

const filteredParticipants = computed(() => {
  return participants.value.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                        p.school.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchStatus = filterStatus.value === 'all' || p.status === filterStatus.value
    return matchSearch && matchStatus
  })
})

const stats = computed(() => {
  const total = participants.value.length
  const pending = participants.value.filter(p => p.status === 'pending_review' || p.essay_score === null).length
  const graded = participants.value.filter(p => p.status === 'graded').length
  const avgMc = total > 0 
    ? Math.round(participants.value.reduce((acc, curr) => acc + (curr.mc_score || 0), 0) / total) 
    : 0
  return { total, pending, graded, avgMc }
})

// Export Rekap Nilai ke Format PDF (jsPDF + autoTable)
const exportToPdf = () => {
  if (filteredParticipants.value.length === 0) {
    alert('Tidak ada data peserta untuk diexport.')
    return
  }

  isExportingPdf.value = true
  try {
    const doc = new jsPDF()

    // Header Dokumen PDF
    doc.setFontSize(16)
    doc.setTextColor(30, 41, 59)
    doc.text('Laporan Hasil Kuis & Ujian', 14, 18)

    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(`Edisi Tanggal: ${formatIndonesianDate(selectedDate.value)}`, 14, 25)
    doc.text(`Total Peserta: ${filteredParticipants.value.length} orang`, 14, 30)

    // Tabel Rekap Hasil
    const tableColumns = [
      'No',
      'Nama Peserta',
      'Asal Sekolah',
      'Skor Pilgan',
      'Skor Essay',
      'Total Nilai',
      'Status'
    ]

    const tableRows = filteredParticipants.value.map((p, idx) => [
      idx + 1,
      p.name,
      p.school,
      p.mc_score ?? 0,
      p.essay_score !== null ? p.essay_score : 'Dalam Proses',
      p.total_score ?? 0,
      p.status === 'graded' ? 'Selesai' : 'Perlu Dinilai'
    ])

    autoTable(doc, {
      startY: 36,
      head: [tableColumns],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235], // Warna biru soft (#2563eb)
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' }
      }
    })

    // Unduh File
    doc.save(`rekap-nilai-kuis-${selectedDate.value}.pdf`)
  } catch (err) {
    console.error('Gagal export PDF:', err)
    alert('Terjadi kesalahan saat membuat file PDF: ' + err.message)
  } finally {
    isExportingPdf.value = false
  }
}

// Buka Modal Penilaian Essay
const openGradingModal = async (participant) => {
  selectedParticipant.value = participant
  showGradeModal.value = true
  participantAnswers.value = []
  gradingInputs.value = {}

  try {
    const data = await getParticipantResult(participant.id)
    if (data && data.answers) {
      participantAnswers.value = data.answers
      data.answers.forEach(ans => {
        if (ans.question_type === 'essay') {
          gradingInputs.value[ans.id] = {
            answerId: ans.id,
            questionId: ans.question_id,
            score: ans.score !== undefined && ans.score !== null ? ans.score : '',
            feedback: ans.admin_feedback || '',
            maxPoints: ans.question?.points || 25
          }
        }
      })
    }
  } catch (e) {
    console.error('Gagal mengambil jawaban peserta:', e)
  }
}

const saveGrading = async () => {
  isSavingGrade.value = true
  try {
    const payload = Object.values(gradingInputs.value).map(item => ({
      answerId: item.answerId,
      questionId: item.questionId,
      score: Number(item.score || 0),
      feedback: item.feedback
    }))

    await gradeEssaySubmissions(selectedParticipant.value.id, payload)
    showGradeModal.value = false
    await loadData()
  } catch (err) {
    alert('Gagal menyimpan nilai: ' + err.message)
  } finally {
    isSavingGrade.value = false
  }
}

// Form Soal (Hanya Opsi A, B, C)
const openAddQuestion = () => {
  isEditing.value = false
  questionForm.value = {
    id: null,
    quiz_date: selectedDate.value,
    type: 'multiple_choice',
    question_text: '',
    options: [
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' }
    ],
    correct_answer: 'A',
    points: 25,
    order_num: questions.value.length + 1
  }
  showQuestionModal.value = true
}

const openEditQuestion = (q) => {
  isEditing.value = true
  // Ambil hanya opsi A, B, C
  let currentOpts = [
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' }
  ]
  if (Array.isArray(q.options)) {
    ['A', 'B', 'C'].forEach((letter, i) => {
      const match = q.options.find(o => o.id === letter)
      if (match) currentOpts[i] = { id: letter, text: match.text }
    })
  }

  questionForm.value = {
    id: q.id,
    quiz_date: q.quiz_date || selectedDate.value,
    type: q.type,
    question_text: q.question_text,
    options: currentOpts,
    correct_answer: ['A', 'B', 'C'].includes(q.correct_answer) ? q.correct_answer : 'A',
    points: q.points || 25,
    order_num: q.order_num || 1
  }
  showQuestionModal.value = true
}

const handleSaveQuestion = async () => {
  if (!questionForm.value.question_text.trim()) {
    alert('Teks pertanyaan wajib diisi')
    return
  }

  isSavingQuestion.value = true
  try {
    const payload = {
      ...questionForm.value,
      options: questionForm.value.type === 'multiple_choice' 
        ? questionForm.value.options.filter(o => ['A', 'B', 'C'].includes(o.id)) 
        : null,
      correct_answer: questionForm.value.type === 'multiple_choice' ? questionForm.value.correct_answer : null,
      points: Number(questionForm.value.points || 25),
      order_num: Number(questionForm.value.order_num || 1)
    }

    await saveQuestion(payload)
    showQuestionModal.value = false
    await loadData()
  } catch (err) {
    alert('Gagal menyimpan soal: ' + err.message)
  } finally {
    isSavingQuestion.value = false
  }
}

const handleDeleteQuestion = async (id) => {
  if (confirm('Hapus butir pertanyaan ini?')) {
    try {
      await deleteQuestion(id)
      await loadData()
    } catch (err) {
      alert('Gagal menghapus: ' + err.message)
    }
  }
}

const handleLogout = () => {
  sessionStorage.removeItem('admin_authenticated')
  router.push('/login')
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-6 sm:py-8">
    <!-- Top Action Bar (Soft Blue Accent) -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-blue-100">
      <div>
        <h1 class="text-lg sm:text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <span>Panel Pengelola Kuis</span>
          <span class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-mono border border-blue-100">Admin</span>
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">
          Kelola bank soal harian, periksa jawaban essay, dan unduh rekap nilai peserta.
        </p>
      </div>

      <!-- Controls -->
      <div class="flex items-center gap-2">
        <!-- Tombol Export PDF -->
        <button
          @click="exportToPdf"
          :disabled="isExportingPdf || filteredParticipants.length === 0"
          class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          title="Export rekap nilai ke format PDF"
        >
          <FileDown class="w-3.5 h-3.5" />
          <span>{{ isExportingPdf ? 'Mengekspor...' : 'Export PDF' }}</span>
        </button>

        <button
          @click="openAddQuestion"
          class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Tambah Soal</span>
        </button>

        <button
          @click="showSupabaseModal = true"
          class="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
          title="Pengaturan Database"
        >
          <Database class="w-4 h-4" />
        </button>

        <button
          @click="handleLogout"
          class="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
          title="Keluar"
        >
          <LogOut class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Date Filter Selector for Daily Quiz -->
    <div class="bg-white rounded-2xl border border-blue-100 p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
      <div class="flex items-center gap-2">
        <Calendar class="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span class="text-xs font-semibold text-slate-700">Tanggal Kuis Aktif:</span>
        <input
          v-model="selectedDate"
          type="date"
          class="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div class="text-xs text-slate-500">
        Menampilkan edisi: <strong class="text-slate-800">{{ formatIndonesianDate(selectedDate) }}</strong>
      </div>
    </div>

    <!-- Stats Overview (Soft Blue) -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div class="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs">
        <span class="text-[11px] text-slate-500 block mb-0.5">Peserta Tanggal Ini</span>
        <div class="text-xl font-bold text-slate-800">{{ stats.total }}</div>
        <span class="text-[10px] text-slate-400 mt-0.5 block">Submit 1x per hari</span>
      </div>

      <div class="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs">
        <span class="text-[11px] text-amber-700 block mb-0.5">Perlu Dinilai</span>
        <div class="text-xl font-bold text-amber-800">{{ stats.pending }}</div>
        <span class="text-[10px] text-amber-600 mt-0.5 block">Essay belum dinilai</span>
      </div>

      <div class="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs">
        <span class="text-[11px] text-blue-700 block mb-0.5">Selesai Dinilai</span>
        <div class="text-xl font-bold text-blue-800">{{ stats.graded }}</div>
        <span class="text-[10px] text-blue-500 mt-0.5 block">Nilai akhir terbit</span>
      </div>

      <div class="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs">
        <span class="text-[11px] text-slate-500 block mb-0.5">Soal Aktif</span>
        <div class="text-xl font-bold text-slate-800">{{ questions.length }}</div>
        <span class="text-[10px] text-slate-400 mt-0.5 block">Pada tanggal ini</span>
      </div>
    </div>

    <!-- Tab Bar -->
    <div class="flex items-center gap-2 border-b border-blue-100 mb-6 pb-2">
      <button
        @click="activeTab = 'participants'"
        class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        :class="activeTab === 'participants' 
          ? 'bg-blue-600 text-white' 
          : 'text-slate-600 hover:bg-slate-100'"
      >
        <Users class="w-3.5 h-3.5" />
        <span>Peserta & Penilaian Essay</span>
        <span 
          v-if="stats.pending > 0"
          class="px-1.5 py-0.2 rounded text-[10px] bg-amber-200 text-amber-900 font-bold ml-1"
        >
          {{ stats.pending }}
        </span>
      </button>

      <button
        @click="activeTab = 'questions'"
        class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        :class="activeTab === 'questions' 
          ? 'bg-blue-600 text-white' 
          : 'text-slate-600 hover:bg-slate-100'"
      >
        <HelpCircle class="w-3.5 h-3.5" />
        <span>Bank Soal ({{ questions.length }})</span>
      </button>
    </div>

    <!-- TAB 1: DAFTAR PESERTA & PENILAIAN ESSAY -->
    <div v-if="activeTab === 'participants'" class="space-y-3">
      <!-- Search & Status Filter -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-blue-100">
        <div class="relative flex-1">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari nama peserta atau asal sekolah..."
            class="w-full text-xs pl-8 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
          />
          <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>

        <div class="flex items-center gap-2">
          <select
            v-model="filterStatus"
            class="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Status ({{ participants.length }})</option>
            <option value="pending_review">Perlu Dinilai ({{ stats.pending }})</option>
            <option value="graded">Selesai ({{ stats.graded }})</option>
          </select>

          <!-- Shortcut Export PDF -->
          <button
            @click="exportToPdf"
            :disabled="filteredParticipants.length === 0"
            class="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <FileDown class="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      <div v-if="isLoading" class="py-12 text-center text-xs text-slate-400">
        Memuat data peserta...
      </div>

      <div v-else-if="filteredParticipants.length === 0" class="bg-white rounded-2xl p-8 text-center border border-blue-100 text-xs text-slate-500">
        Belum ada peserta yang menyelesaikan kuis pada tanggal ini.
      </div>

      <!-- List of Participants -->
      <div v-else class="space-y-2.5">
        <div 
          v-for="p in filteredParticipants" 
          :key="p.id"
          class="bg-white rounded-xl p-4 border border-blue-100/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-sm text-slate-800">{{ p.name }}</span>
              <span 
                class="px-2 py-0.5 rounded text-[10px] font-medium"
                :class="p.status === 'graded' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                  : 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold'"
              >
                {{ p.status === 'graded' ? 'Selesai' : 'Perlu Dinilai' }}
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <Building2 class="w-3 h-3 text-slate-400" />
              <span>{{ p.school }}</span>
            </p>
            <span class="text-[10px] text-slate-400 block mt-1">
              Waktu: {{ new Date(p.submitted_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }} WIB
            </span>
          </div>

          <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <div class="flex items-center gap-3 text-right text-xs">
              <div>
                <span class="text-[10px] text-slate-400 block">Pilgan</span>
                <span class="font-bold text-blue-700">{{ p.mc_score ?? 0 }}</span>
              </div>
              <div class="border-l border-slate-200 pl-3">
                <span class="text-[10px] text-slate-400 block">Essay</span>
                <span class="font-bold" :class="p.essay_score !== null ? 'text-blue-700' : 'text-amber-600'">
                  {{ p.essay_score !== null ? p.essay_score : '-' }}
                </span>
              </div>
              <div class="border-l border-slate-200 pl-3">
                <span class="text-[10px] text-slate-400 block">Total</span>
                <span class="font-black text-slate-800">{{ p.total_score ?? 0 }}</span>
              </div>
            </div>

            <button
              @click="openGradingModal(p)"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer"
              :class="p.status === 'graded'
                ? 'border-slate-200 hover:bg-slate-50 text-slate-700'
                : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-xs'"
            >
              {{ p.status === 'graded' ? 'Ubah Nilai' : 'Nilai Essay' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: BANK SOAL (HANYA OPSI A, B, C) -->
    <div v-else-if="activeTab === 'questions'" class="space-y-3">
      <div v-if="questions.length === 0" class="bg-white rounded-2xl p-8 text-center border border-blue-100 text-xs text-slate-500">
        Belum ada soal untuk tanggal ini. Klik tombol "Tambah Soal" untuk membuat soal baru dengan opsi A, B, C.
      </div>

      <div v-else class="space-y-2.5">
        <div 
          v-for="(q, idx) in questions" 
          :key="q.id"
          class="bg-white rounded-xl p-4 border border-blue-100/90 shadow-2xs space-y-2.5"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="w-5 h-5 rounded bg-blue-50 font-bold text-xs flex items-center justify-center text-blue-700">
                {{ idx + 1 }}
              </span>
              <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                {{ q.type === 'multiple_choice' ? 'Pilihan Ganda (Opsi A, B, C)' : 'Essay' }}
              </span>
              <span class="text-xs text-slate-400">
                Bobot: {{ q.points || 25 }} Poin
              </span>
            </div>

            <div class="flex items-center gap-1">
              <button 
                @click="openEditQuestion(q)"
                class="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
                title="Edit Soal"
              >
                <Edit3 class="w-3.5 h-3.5" />
              </button>
              <button 
                @click="handleDeleteQuestion(q.id)"
                class="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                title="Hapus Soal"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p class="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-line">
            {{ q.question_text }}
          </p>

          <!-- Opsi A, B, C Saja -->
          <div v-if="q.type === 'multiple_choice' && q.options" class="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <div 
              v-for="opt in q.options.filter(o => ['A', 'B', 'C'].includes(o.id))" 
              :key="opt.id"
              class="p-2 rounded-lg flex items-center gap-2 border"
              :class="q.correct_answer === opt.id 
                ? 'bg-blue-50 border-blue-300 font-semibold text-blue-900' 
                : 'bg-slate-50 border-slate-200 text-slate-600'"
            >
              <span 
                class="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center"
                :class="q.correct_answer === opt.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'"
              >
                {{ opt.id }}
              </span>
              <span class="truncate flex-1">{{ opt.text }}</span>
              <span v-if="q.correct_answer === opt.id" class="text-[10px] text-blue-600 font-bold">(Kunci)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL PENILAIAN ESSAY -->
    <div v-if="showGradeModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div class="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
        <div class="p-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <div>
            <h3 class="font-bold text-sm text-slate-800">Pemeriksaan Jawaban Essay</h3>
            <p class="text-xs text-slate-500">
              Peserta: {{ selectedParticipant?.name }} ({{ selectedParticipant?.school }})
            </p>
          </div>
          <button @click="showGradeModal = false" class="p-1 rounded text-slate-400 hover:text-slate-800">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="p-4 space-y-4 overflow-y-auto flex-1">
          <div 
            v-for="(item, key) in gradingInputs" 
            :key="key"
            class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5"
          >
            <div>
              <span class="text-[10px] font-semibold text-blue-600 uppercase block">
                Pertanyaan Essay (Maksimal {{ item.maxPoints }} Poin)
              </span>
              <p class="text-xs font-medium text-slate-800 mt-0.5">
                {{ participantAnswers.find(a => a.id === item.answerId)?.question?.question_text }}
              </p>
            </div>

            <div class="bg-white p-3 rounded-lg border border-slate-200">
              <span class="text-[10px] text-slate-400 block mb-0.5">Jawaban Peserta:</span>
              <p class="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                {{ participantAnswers.find(a => a.id === item.answerId)?.essay_answer || '(Tidak diisi)' }}
              </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">
                  Beri Nilai (0 - {{ item.maxPoints }})
                </label>
                <input
                  v-model="item.score"
                  type="number"
                  :min="0"
                  :max="item.maxPoints"
                  placeholder="0"
                  class="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div class="sm:col-span-2">
                <label class="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan / Feedback Penilai
                </label>
                <input
                  v-model="item.feedback"
                  type="text"
                  placeholder="Opsional..."
                  class="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            @click="showGradeModal = false"
            class="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
          >
            Batal
          </button>
          <button
            @click="saveGrading"
            :disabled="isSavingGrade"
            class="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {{ isSavingGrade ? 'Menyimpan...' : 'Simpan Nilai' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL FORM SOAL (OPSI HANYA A, B, C) -->
    <div v-if="showQuestionModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div class="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
        <div class="p-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <h3 class="font-bold text-sm text-slate-800">
            {{ isEditing ? 'Edit Soal' : 'Tambah Soal Baru' }}
          </h3>
          <button @click="showQuestionModal = false" class="p-1 rounded text-slate-400 hover:text-slate-800">
            <X class="w-4 h-4" />
          </button>
        </div>

        <form @submit.prevent="handleSaveQuestion" class="p-4 space-y-3.5 overflow-y-auto flex-1">
          <!-- Tanggal Kuis -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Tanggal Kuis</label>
            <input
              v-model="questionForm.quiz_date"
              type="date"
              required
              class="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 font-mono focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <!-- Tipe Soal -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Tipe Pertanyaan</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                @click="questionForm.type = 'multiple_choice'"
                class="py-2 px-3 rounded-lg border text-xs font-medium text-center"
                :class="questionForm.type === 'multiple_choice' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-200 text-slate-600'"
              >
                Pilihan Ganda (Opsi A, B, C)
              </button>
              <button
                type="button"
                @click="questionForm.type = 'essay'"
                class="py-2 px-3 rounded-lg border text-xs font-medium text-center"
                :class="questionForm.type === 'essay' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-200 text-slate-600'"
              >
                Essay
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Teks Pertanyaan</label>
            <textarea
              v-model="questionForm.question_text"
              rows="3"
              required
              placeholder="Tuliskan teks pertanyaan di sini..."
              class="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            ></textarea>
          </div>

          <!-- Opsi Pilgan (Hanya A, B, C) -->
          <div v-if="questionForm.type === 'multiple_choice'" class="space-y-2 pt-2 border-t border-slate-100">
            <label class="block text-xs font-semibold text-slate-700">Opsi Pilihan (A, B, C) & Kunci Jawaban</label>
            <div v-for="opt in questionForm.options" :key="opt.id" class="flex items-center gap-2">
              <span class="w-6 h-6 rounded bg-blue-50 font-bold text-xs flex items-center justify-center text-blue-700 flex-shrink-0">
                {{ opt.id }}
              </span>
              <input
                v-model="opt.text"
                type="text"
                required
                :placeholder="`Teks opsi ${opt.id}...`"
                class="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                @click="questionForm.correct_answer = opt.id"
                class="px-2.5 py-1 rounded-md text-[11px] font-semibold border"
                :class="questionForm.correct_answer === opt.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500 border-slate-200'"
              >
                Kunci
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Bobot Poin</label>
              <input
                v-model="questionForm.points"
                type="number"
                min="1"
                required
                class="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Nomor Urutan</label>
              <input
                v-model="questionForm.order_num"
                type="number"
                min="1"
                required
                class="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div class="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              @click="showQuestionModal = false"
              type="button"
              class="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              :disabled="isSavingQuestion"
              class="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 cursor-pointer shadow-xs"
            >
              Simpan Soal
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL DATABASE SUPABASE -->
    <SupabaseConfigModal 
      :is-open="showSupabaseModal" 
      @close="showSupabaseModal = false" 
    />
  </div>
</template>
