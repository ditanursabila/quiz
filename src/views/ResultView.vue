<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Building2, 
  RefreshCw, 
  FileText, 
  AlertCircle,
  Home
} from 'lucide-vue-next'
import { getParticipantResult, formatIndonesianDate } from '../lib/supabase'

const route = useRoute()
const router = useRouter()

const participantId = computed(() => route.params.id)
const participant = ref(null)
const answers = ref([])
const isLoading = ref(true)
const isRefreshing = ref(false)
const errorMsg = ref('')

const loadResult = async (showRefreshSpin = false) => {
  if (showRefreshSpin) isRefreshing.value = true
  errorMsg.value = ''

  try {
    const data = await getParticipantResult(participantId.value)
    if (data && data.participant) {
      participant.value = data.participant
      answers.value = data.answers || []
    } else {
      errorMsg.value = 'Data hasil kuis tidak ditemukan.'
    }
  } catch (err) {
    console.error('Error memuat hasil:', err)
    errorMsg.value = 'Gagal memuat hasil kuis.'
  } finally {
    isLoading.value = false
    if (showRefreshSpin) isRefreshing.value = false
  }
}

onMounted(() => {
  loadResult()
})

const mcAnswers = computed(() => answers.value.filter(a => a.question_type === 'multiple_choice'))
const essayAnswers = computed(() => answers.value.filter(a => a.question_type === 'essay'))

const correctMcCount = computed(() => mcAnswers.value.filter(a => a.is_correct).length)
const wrongMcCount = computed(() => mcAnswers.value.filter(a => !a.is_correct).length)

const isEssayPending = computed(() => {
  return participant.value?.status === 'pending_review' || participant.value?.essay_score === null
})
</script>

<template>
  <div class="max-w-md mx-auto px-4 py-8 sm:py-10">
    <div v-if="isLoading" class="py-20 text-center">
      <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <p class="text-xs text-slate-500">Memuat lembar evaluasi...</p>
    </div>

    <div v-else-if="errorMsg" class="bg-white rounded-2xl p-6 text-center border border-slate-200">
      <AlertCircle class="w-8 h-8 text-slate-400 mx-auto mb-2" />
      <h3 class="text-sm font-semibold text-slate-800">{{ errorMsg }}</h3>
      <button 
        @click="router.push('/')"
        class="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700"
      >
        Kembali ke Beranda
      </button>
    </div>

    <div v-else-if="participant" class="space-y-4">
      <div class="bg-white rounded-2xl border border-blue-100/90 p-5 shadow-xs text-center">
        <div class="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 border border-blue-100">
          <CheckCircle class="w-5 h-5" />
        </div>
        <h1 class="text-base sm:text-lg font-bold text-slate-800">
          Jawaban Kuis Berhasil Terkirim
        </h1>
        <p class="text-xs text-slate-500 mt-1 leading-relaxed">
          Kuis telah terekam di sistem. Nilai pilihan ganda otomatis terhitung di bawah ini.
        </p>
      </div>

      <div class="bg-white rounded-2xl border border-blue-100/90 p-4 shadow-xs flex items-center justify-between">
        <div>
          <h3 class="font-bold text-sm text-slate-800">{{ participant.name }}</h3>
          <p class="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <Building2 class="w-3.5 h-3.5 text-blue-400" />
            <span>{{ participant.school }}</span>
          </p>
          <span class="text-[10px] text-slate-400 block mt-1">
            Edisi: {{ formatIndonesianDate(participant.quiz_date) }}
          </span>
        </div>

        <button 
          @click="loadResult(true)"
          :disabled="isRefreshing"
          title="Perbarui status nilai essay"
          class="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin text-blue-600': isRefreshing }" />
          <span class="hidden xs:inline">Refresh</span>
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="bg-white rounded-2xl p-4 border border-blue-100 shadow-xs">
          <span class="text-[11px] font-medium text-blue-700 block mb-1">
            Skor Pilihan Ganda
          </span>
          <div class="text-2xl font-bold text-slate-800 tracking-tight">
            {{ participant.mc_score }}
            <span class="text-xs font-normal text-slate-400">Poin</span>
          </div>
          <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span class="text-blue-700 font-medium">{{ correctMcCount }} Benar</span>
            <span class="text-slate-400">{{ wrongMcCount }} Salah</span>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-4 border border-blue-100 shadow-xs">
          <span class="text-[11px] font-medium text-blue-700 block mb-1">
            Nilai Essay
          </span>

          <div v-if="isEssayPending">
            <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium mt-1">
              <Clock class="w-3 h-3 text-amber-500" />
              <span>Dalam Proses</span>
            </div>
            <p class="text-[10px] text-slate-400 mt-2 leading-tight">
              Menunggu pemeriksaan tim penilai
            </p>
          </div>

          <div v-else>
            <div class="text-2xl font-bold text-slate-800 tracking-tight">
              {{ participant.essay_score }}
              <span class="text-xs font-normal text-slate-400">Poin</span>
            </div>
            <span class="text-[10px] text-blue-600 block mt-2.5 pt-2 border-t border-slate-100">
              Telah dinilai
            </span>
          </div>
        </div>
      </div>

      <div v-if="!isEssayPending" class="bg-blue-600 rounded-2xl p-4 text-white shadow-xs flex items-center justify-between">
        <div>
          <span class="text-[11px] text-blue-100 uppercase tracking-wider block">Total Skor Akhir</span>
          <span class="text-xl font-bold">{{ participant.total_score }} Poin</span>
        </div>
        <span class="text-xs bg-white/20 text-white px-3 py-1 rounded-full font-medium">
          Selesai Dinilai
        </span>
      </div>

      <div class="space-y-2.5 pt-2">
        <h3 class="font-bold text-xs text-slate-700 flex items-center gap-1.5">
          <FileText class="w-3.5 h-3.5 text-blue-600" />
          Rincian Jawaban Soal:
        </h3>

        <div 
          v-for="(ans, idx) in answers" 
          :key="ans.id || idx"
          class="bg-white rounded-xl p-4 border border-blue-100/90 shadow-2xs space-y-2.5"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-[10px] font-medium text-slate-400 block">
                Soal {{ idx + 1 }} • {{ ans.question_type === 'multiple_choice' ? 'Pilihan Ganda' : 'Essay' }}
              </span>
              <p class="text-xs font-medium text-slate-800 mt-0.5 leading-relaxed">
                {{ ans.question?.question_text || 'Pertanyaan' }}
              </p>
            </div>

            <div class="flex-shrink-0">
              <span 
                v-if="ans.question_type === 'multiple_choice'"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                :class="ans.is_correct 
                  ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-100' 
                  : 'bg-slate-50 text-slate-400 border border-slate-200'"
              >
                {{ ans.is_correct ? `Benar (+${ans.score})` : 'Salah (0)' }}
              </span>
              <span 
                v-else
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100"
              >
                {{ isEssayPending ? 'Dalam Proses' : `Nilai: ${ans.score}` }}
              </span>
            </div>
          </div>

          <div v-if="ans.question_type === 'multiple_choice'" class="text-xs bg-slate-50/70 p-2.5 rounded-lg space-y-1 text-slate-600">
            <div class="flex items-center justify-between">
              <span class="text-slate-400">Pilihan Anda:</span>
              <span class="font-medium text-slate-800">Opsi {{ ans.selected_option || 'Tidak dijawab' }}</span>
            </div>
            <div class="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/50">
              <span class="text-slate-400">Kunci Jawaban:</span>
              <span class="font-medium text-slate-700">Opsi {{ ans.question?.correct_answer }}</span>
            </div>
          </div>

          <div v-else class="space-y-2">
            <div class="bg-slate-50/70 p-2.5 rounded-lg text-xs text-slate-700">
              <span class="text-[10px] text-slate-400 block mb-0.5">Jawaban Anda:</span>
              <p class="whitespace-pre-line leading-relaxed">{{ ans.essay_answer || '(Tidak diisi)' }}</p>
            </div>

            <div v-if="ans.admin_feedback" class="bg-blue-50/80 p-2.5 rounded-lg text-xs text-slate-800 border border-blue-100">
              <span class="text-[10px] font-semibold text-blue-700 block mb-0.5">Catatan Penilai:</span>
              <p class="leading-relaxed">{{ ans.admin_feedback }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="pt-3">
        <button
          @click="router.push('/')"
          class="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Home class="w-3.5 h-3.5" />
          <span>Kembali ke Halaman Depan</span>
        </button>
      </div>
    </div>
  </div>
</template>
