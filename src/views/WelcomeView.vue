<script setup>
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import {
  User,
  Building2,
  ArrowRight,
  Calendar,
  HelpCircle,
  AlertCircle,
} from "lucide-vue-next";
import {
  checkParticipantSubmission,
  getQuestions,
  getTodayDateString,
  formatIndonesianDate,
} from "../lib/supabase";

const router = useRouter();

const todayDate = getTodayDateString();
const todayFormatted = computed(() => formatIndonesianDate(todayDate));

// Input selalu dikosongkan setiap kali reload
const name = ref("");
const school = ref("");
const isChecking = ref(false);
const errorMessage = ref("");
const previousSubmission = ref(null);

const stats = ref({
  total: 0,
  mcCount: 0,
  essayCount: 0,
});

onMounted(async () => {
  try {
    const list = await getQuestions(todayDate);
    stats.value.total = list.length;
    stats.value.mcCount = list.filter((q) => q.type === "multiple_choice").length;
    stats.value.essayCount = list.filter((q) => q.type === "essay").length;
  } catch (e) {
    console.error("Gagal mengambil data soal hari ini:", e);
  }
});

const handleStartQuiz = async () => {
  errorMessage.value = "";
  previousSubmission.value = null;

  if (!name.value.trim()) {
    errorMessage.value = "Silakan isi Nama Lengkap Anda terlebih dahulu";
    return;
  }

  if (!school.value.trim()) {
    errorMessage.value = "Silakan isi Asal Sekolah atau Instansi Anda";
    return;
  }

  isChecking.value = true;

  try {
    const existing = await checkParticipantSubmission(
      name.value,
      school.value,
      todayDate
    );

    if (existing) {
      previousSubmission.value = existing;
      errorMessage.value =
        "Anda sudah mengirimkan jawaban untuk kuis edisi hari ini. Pengiriman hanya dapat dilakukan satu kali per hari.";
      isChecking.value = false;
      return;
    }

    sessionStorage.setItem("current_participant_name", name.value.trim());
    sessionStorage.setItem("current_participant_school", school.value.trim());

    router.push("/quiz");
  } catch (err) {
    console.error("Verifikasi peserta gagal:", err);
    errorMessage.value = "Terjadi kendala saat memeriksa data. Silakan coba kembali.";
  } finally {
    isChecking.value = false;
  }
};

const goToPreviousResult = () => {
  if (previousSubmission.value) {
    router.push(`/result/${previousSubmission.value.id}`);
  }
};
</script>

<template>
  <div class="max-w-md mx-auto px-4 py-8 sm:py-12">
    <!-- Intro Card (Soft Blue Theme with Clean Transparent Logo) -->
    <div class="bg-white rounded-2xl border border-blue-100/90 p-6 sm:p-7 shadow-xs mb-5">
      <div class="flex items-center justify-between gap-2 mb-4">
        <img src="/logo.png" alt="Quiz Logo" class="h-10 sm:h-12 w-auto object-contain select-none" />
        <span
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100/90">
          <Calendar class="w-3.5 h-3.5 text-blue-500" />
          {{ todayFormatted }}
        </span>
      </div>

      <h1 class="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight leading-snug">
        Kuis Wawasan Harian
      </h1>
      <p class="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
        Selamat datang! Uji pemahaman Anda melalui kuis wawasan harian dengan opsi pilihan
        ganda dan pertanyaan essay.
      </p>

      <!-- Overview Info -->
      <div class="grid grid-cols-2 gap-2.5 mt-5 pt-4 border-t border-slate-100">
        <div class="bg-blue-50/50 rounded-xl p-3 border border-blue-100/60">
          <span class="text-[11px] text-blue-700 font-medium block">Pilihan Ganda</span>
          <span class="text-base font-bold text-slate-800">{{ stats.mcCount }} Soal</span>
          <span class="text-[10px] text-slate-400 block mt-0.5">Koreksi otomatis</span>
        </div>
        <div class="bg-blue-50/50 rounded-xl p-3 border border-blue-100/60">
          <span class="text-[11px] text-blue-700 font-medium block">Pertanyaan Essay</span>
          <span class="text-base font-bold text-slate-800">{{ stats.essayCount }} Soal</span>
          <span class="text-[10px] text-slate-400 block mt-0.5">Dinilai oleh tim</span>
        </div>
      </div>
    </div>

    <!-- Registration Form -->
    <div class="bg-white rounded-2xl border border-blue-100/90 p-6 sm:p-7 shadow-xs">
      <h2 class="text-sm font-bold text-slate-800 mb-1">Data Diri Peserta</h2>
      <p class="text-xs text-slate-500 mb-5">
        Lengkapi nama dan asal sekolah / instansi untuk memulai kuis.
      </p>

      <form @submit.prevent="handleStartQuiz" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <User class="w-3.5 h-3.5 text-blue-500" />
            Nama Lengkap
          </label>
          <input v-model="name" type="text" placeholder="Masukkan nama lengkap Anda" required autocomplete="off"
            class="w-full text-sm px-3.5 py-2.5 rounded-xl bg-slate-50/70 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 text-slate-800" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Building2 class="w-3.5 h-3.5 text-blue-500" />
            Asal Sekolah / Instansi
          </label>
          <input v-model="school" type="text" placeholder="Contoh: SMA Negeri 1 / Umum" required autocomplete="off"
            class="w-full text-sm px-3.5 py-2.5 rounded-xl bg-slate-50/70 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 text-slate-800" />
        </div>

        <!-- Alert Error or Already Submitted -->
        <div v-if="errorMessage"
          class="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-slate-700 text-xs flex items-start gap-2.5">
          <AlertCircle class="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div class="flex-1">
            <p class="font-medium leading-relaxed">{{ errorMessage }}</p>
            <button v-if="previousSubmission" type="button" @click="goToPreviousResult"
              class="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 transition-colors">
              <span>Lihat Hasil Nilai Anda</span>
              <ArrowRight class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <button type="submit" :disabled="isChecking"
          class="w-full py-3 px-4 rounded-xl font-semibold text-xs text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2 shadow-xs shadow-blue-600/20">
          <span v-if="!isChecking">Mulai Mengerjakan</span>
          <span v-else>Memeriksa...</span>
          <ArrowRight v-if="!isChecking" class="w-4 h-4" />
        </button>
      </form>
    </div>

    <!-- Catatan Pengerjaan -->
    <div class="mt-5 p-4 rounded-xl bg-white/70 border border-blue-100 text-xs text-slate-600 space-y-1.5 shadow-2xs">
      <div class="font-semibold text-slate-700 flex items-center gap-1.5">
        <HelpCircle class="w-3.5 h-3.5 text-blue-500" />
        Ketentuan Kuis:
      </div>
      <ul class="space-y-1 pl-4 list-disc text-slate-500 text-[11px] leading-relaxed">
        <li>
          Semua soal (pilihan ganda dan essay) wajib diisi seluruhnya sebelum mengirim.
        </li>
        <li>
          Setiap peserta hanya dapat mengirimkan jawaban sebanyak satu kali dalam sehari.
        </li>
        <li>Pilihan ganda menggunakan opsi A, B, dan C.</li>
      </ul>
    </div>
  </div>
</template>
