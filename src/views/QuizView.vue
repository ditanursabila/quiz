<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  AlertCircle, 
  HelpCircle,
  Check
} from 'lucide-vue-next'
import { 
  getQuestions, 
  submitQuizAnswers, 
  checkParticipantSubmission, 
  getTodayDateString 
} from '../lib/supabase'

const router = useRouter()
const todayDate = getTodayDateString()

const participantName = ref('')
const participantSchool = ref('')
const questions = ref([])
const currentIndex = ref(0)
const answers = reactive({})
const isLoading = ref(true)
const isSubmitting = ref(false)
const showConfirmModal = ref(false)
const submitError = ref('')

onMounted(async () => {
  const name = sessionStorage.getItem('current_participant_name')
  const school = sessionStorage.getItem('current_participant_school')

  if (!name || !school) {
    router.replace('/')
    return
  }

  participantName.value = name
  participantSchool.value = school

  // Cek apakah sudah pernah submit hari ini
  const alreadySubmitted = await checkParticipantSubmission(name, school, todayDate)
  if (alreadySubmitted) {
    router.replace(`/result/${alreadySubmitted.id}`)
    return
  }

  try {
    const list = await getQuestions(todayDate)
    questions.value = list
    list.forEach(q => {
      answers[q.id] = {
        selected_option: null,
        essay_answer: ''
      }
    })
  } catch (err) {
    console.error('Gagal memuat soal:', err)
  } finally {
    isLoading.value = false
  }
})

const currentQuestion = computed(() => questions.value[currentIndex.value] || null)

// Filter opsi pilihan ganda khusus A, B, C saja
const currentOptions = computed(() => {
  if (!currentQuestion.value || !Array.isArray(currentQuestion.value.options)) return []
  return currentQuestion.value.options.filter(opt => ['A', 'B', 'C'].includes(opt.id))
})

const isAnswered = (qId) => {
  const ans = answers[qId]
  if (!ans) return false
  const q = questions.value.find(item => item.id === qId)
  if (!q) return false
  if (q.type === 'multiple_choice') {
    return !!ans.selected_option
  } else {
    return !!(ans.essay_answer && ans.essay_answer.trim().length > 0)
  }
}

const answeredCount = computed(() => {
  return questions.value.filter(q => isAnswered(q.id)).length
})

const progressPercentage = computed(() => {
  if (questions.value.length === 0) return 0
  return Math.round((answeredCount.value / questions.value.length) * 100)
})

const selectOption = (optId) => {
  if (!currentQuestion.value) return
  answers[currentQuestion.value.id].selected_option = optId
  submitError.value = ''
}

const goToQuestion = (idx) => {
  currentIndex.value = idx
  submitError.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const nextQuestion = () => {
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
    submitError.value = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const prevQuestion = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    submitError.value = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Validasi sebelum submit: Semua soal wajib terisi!
const handleCheckAndSubmit = () => {
  submitError.value = ''

  // Periksa apakah ada soal yang belum dijawab
  const unanswered = []
  questions.value.forEach((q, idx) => {
    if (!isAnswered(q.id)) {
      unanswered.push(idx + 1)
    }
  })

  if (unanswered.length > 0) {
    submitError.value = `Semua pertanyaan wajib diisi lengkap. Masih ada soal nomor ${unanswered.join(', ')} yang belum Anda jawab.`
    return
  }

  showConfirmModal.value = true
}

const handleSubmitQuiz = async () => {
  showConfirmModal.value = false
  isSubmitting.value = true
  submitError.value = ''

  try {
    const res = await submitQuizAnswers({
      name: participantName.value,
      school: participantSchool.value,
      answers: answers,
      questions: questions.value,
      dateStr: todayDate
    })

    sessionStorage.removeItem('current_participant_name')
    sessionStorage.removeItem('current_participant_school')

    router.push(`/result/${res.participant.id}`)
  } catch (err) {
    console.error('Submit error:', err)
    submitError.value = 'Gagal mengirimkan lembar jawaban: ' + (err.message || 'Silakan periksa koneksi internet.')
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen-safe pb-28">
    <!-- Header Info Bar (Soft Blue) -->
    <div class="bg-white/90 backdrop-blur-md border-b border-blue-100 sticky top-14 z-20">
      <div class="max-w-md mx-auto px-4 py-2.5">
        <div class="flex items-center justify-between text-xs mb-2">
          <div class="flex items-center gap-1.5 truncate text-slate-700">
            <span class="font-semibold truncate">{{ participantName }}</span>
            <span class="text-slate-300">/</span>
            <span class="text-slate-500 truncate text-[11px]">{{ participantSchool }}</span>
          </div>
          <div class="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 flex-shrink-0">
            {{ answeredCount }} dari {{ questions.length }} terjawab
          </div>
        </div>

        <!-- Progress Indicator -->
        <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div 
            class="bg-blue-600 h-full rounded-full transition-all duration-200 ease-out"
            :style="{ width: `${progressPercentage}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="max-w-md mx-auto px-4 py-20 text-center">
      <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <p class="text-xs text-slate-500">Menyiapkan daftar pertanyaan kuis...</p>
    </div>

    <!-- Question Content -->
    <div v-else-if="currentQuestion" class="max-w-md mx-auto px-4 pt-4">
      <!-- Quick navigation buttons -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-3 mb-2 no-scrollbar">
        <button
          v-for="(q, idx) in questions"
          :key="q.id"
          @click="goToQuestion(idx)"
          class="flex-shrink-0 w-8 h-8 rounded-xl font-medium text-xs flex items-center justify-center transition-all cursor-pointer"
          :class="[
            currentIndex === idx 
              ? 'bg-blue-600 text-white shadow-xs' 
              : isAnswered(q.id)
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          ]"
        >
          {{ idx + 1 }}
        </button>
      </div>

      <!-- Main Card (Soft Blue Border) -->
      <div class="bg-white rounded-2xl p-5 sm:p-6 border border-blue-100/90 shadow-xs">
        <div class="flex items-center justify-between gap-2 mb-3.5">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
            {{ currentQuestion.type === 'multiple_choice' ? 'Pilihan Ganda (Opsi A, B, C)' : 'Pertanyaan Essay' }}
          </span>
          <span class="text-xs text-slate-400">
            Bobot: {{ currentQuestion.points || 25 }} Poin
          </span>
        </div>

        <div class="mb-5">
          <span class="text-[11px] font-medium text-slate-400 block mb-1">
            Soal Nomor {{ currentIndex + 1 }} dari {{ questions.length }}
          </span>
          <p class="text-sm sm:text-base font-semibold text-slate-800 leading-relaxed whitespace-pre-line">
            {{ currentQuestion.question_text }}
          </p>
        </div>

        <!-- Multiple Choice Options (Only A, B, C) -->
        <div v-if="currentQuestion.type === 'multiple_choice'" class="space-y-2.5">
          <button
            v-for="opt in currentOptions"
            :key="opt.id"
            @click="selectOption(opt.id)"
            type="button"
            class="w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer"
            :class="answers[currentQuestion.id]?.selected_option === opt.id
              ? 'bg-blue-50/70 border-blue-500 ring-1 ring-blue-500/20 text-blue-900 font-medium'
              : 'bg-slate-50/60 border-slate-200/90 hover:bg-blue-50/40 text-slate-700'"
          >
            <div 
              class="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors"
              :class="answers[currentQuestion.id]?.selected_option === opt.id
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-300 text-slate-600'"
            >
              {{ opt.id }}
            </div>
            <span class="text-xs sm:text-sm pt-0.5 flex-1 leading-relaxed">
              {{ opt.text }}
            </span>
          </button>
        </div>

        <!-- Essay Textarea -->
        <div v-else-if="currentQuestion.type === 'essay'" class="space-y-2">
          <textarea
            v-model="answers[currentQuestion.id].essay_answer"
            @input="submitError = ''"
            rows="6"
            placeholder="Tuliskan jawaban essay Anda di sini (wajib diisi)..."
            class="w-full text-xs sm:text-sm p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y leading-relaxed text-slate-800"
          ></textarea>
          <div class="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
            <span>Wajib diisi sebelum mengirim kuis.</span>
            <span>{{ answers[currentQuestion.id]?.essay_answer?.length || 0 }} karakter</span>
          </div>
        </div>
      </div>

      <!-- Alert Notifikasi Jika Belum Lengkap -->
      <div v-if="submitError" class="mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2.5 animate-fade-in">
        <AlertCircle class="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
        <span class="leading-relaxed">{{ submitError }}</span>
      </div>
    </div>

    <!-- Mobile Bottom Action Bar -->
    <div class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-blue-100 p-3.5 z-20 shadow-xs">
      <div class="max-w-md mx-auto flex items-center justify-between gap-2">
        <!-- Tombol Sebelumnya -->
        <button
          @click="prevQuestion"
          :disabled="currentIndex === 0"
          type="button"
          class="px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
        >
          <ChevronLeft class="w-4 h-4" />
          <span>Sebelumnya</span>
        </button>

        <!-- Di soal 1, 2, ... N-1 HANYA MUNCUL 'Selanjutnya'. 
             TOMBOL SUBMIT HANYA MUNCUL DI SOAL TERAKHIR SESUAI PERMINTAAN PENGGUNA -->
        <div class="flex items-center gap-2">
          <!-- Tombol Selanjutnya (Soal 1 sampai N-1) -->
          <button
            v-if="currentIndex < questions.length - 1"
            @click="nextQuestion"
            type="button"
            class="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900 flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
          >
            <span>Selanjutnya</span>
            <ChevronRight class="w-4 h-4" />
          </button>

          <!-- Tombol Kirim Jawaban (HANYA MUNCUL DI SOAL TERAKHIR) -->
          <button
            v-else
            @click="handleCheckAndSubmit"
            :disabled="isSubmitting"
            type="button"
            class="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm shadow-blue-600/25 active:scale-95"
          >
            <Send class="w-3.5 h-3.5" />
            <span>Kirim Jawaban</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm Submit Modal -->
    <div v-if="showConfirmModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl border border-slate-200 text-center">
        <div class="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 border border-blue-100">
          <HelpCircle class="w-5 h-5" />
        </div>

        <h3 class="text-base font-bold text-slate-800">Kirim Seluruh Jawaban?</h3>
        <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">
          Semua {{ questions.length }} soal telah Anda lengkapi dengan baik.
        </p>

        <div class="mt-3 p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-left text-[11px] text-slate-600 leading-relaxed">
          Perhatian: Setiap peserta hanya dapat mengirimkan jawaban sebanyak 1 kali per hari. Jawaban tidak dapat diubah setelah dikirim.
        </div>

        <div class="flex items-center gap-2 mt-5">
          <button
            @click="showConfirmModal = false"
            type="button"
            class="w-1/2 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Periksa Lagi
          </button>
          <button
            @click="handleSubmitQuiz"
            type="button"
            class="w-1/2 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer"
          >
            Ya, Kirimkan
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
