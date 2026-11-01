<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { ArrowRight, AlertCircle } from "lucide-vue-next";
import { ADMIN_PASSCODE } from "../lib/supabase";

const router = useRouter();
const passcode = ref("");
const errorMsg = ref("");
const isLoading = ref(false);

const handleLogin = () => {
  errorMsg.value = "";
  if (!passcode.value.trim()) {
    errorMsg.value = "Silakan masukkan kode sandi administrator";
    return;
  }

  isLoading.value = true;

  setTimeout(() => {
    if (passcode.value.trim() === ADMIN_PASSCODE) {
      sessionStorage.setItem("admin_authenticated", "true");
      router.push("/admin");
    } else {
      errorMsg.value = "Kode sandi tidak valid. Silakan coba kembali.";
    }
    isLoading.value = false;
  }, 250);
};
</script>

<template>
  <div class="min-h-[80vh] flex items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm">
      <div
        class="bg-white rounded-2xl border border-blue-100/90 shadow-sm p-6 sm:p-8 text-center"
      >
        <div class="mb-5 flex justify-center">
          <img
            src="/logo.png"
            alt="Quiz Logo"
            class="h-10 w-auto object-contain select-none"
          />
        </div>

        <h1 class="text-lg font-bold text-slate-800 tracking-tight">Masuk Pengelola</h1>
        <p class="text-xs text-slate-500 mt-1 mb-6">
          Halaman khusus administrator untuk mengelola soal, menilai essay, dan ekspor
          PDF.
        </p>

        <form @submit.prevent="handleLogin" class="space-y-4 text-left">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5">
              Kode Sandi Akses
            </label>
            <input
              v-model="passcode"
              type="password"
              placeholder="Masukkan kode sandi..."
              autofocus
              required
              class="w-full text-sm px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-slate-800"
            />
          </div>

          <div
            v-if="errorMsg"
            class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2"
          >
            <AlertCircle class="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{{ errorMsg }}</span>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs shadow-blue-600/20"
          >
            <span>{{ isLoading ? "Memverifikasi..." : "Buka Panel Pengelola" }}</span>
            <ArrowRight v-if="!isLoading" class="w-3.5 h-3.5" />
          </button>
        </form>

        <div class="mt-6 pt-5 border-t border-slate-100 text-center">
          <router-link
            to="/"
            class="text-xs text-slate-400 hover:text-blue-600 transition-colors"
          >
            Kembali ke Halaman Peserta
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
