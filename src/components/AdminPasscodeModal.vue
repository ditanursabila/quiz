<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ShieldCheck, Lock, X, AlertCircle } from 'lucide-vue-next'
import { ADMIN_PASSCODE } from '../lib/supabase'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close', 'authenticated'])
const router = useRouter()

const passcode = ref('')
const errorMsg = ref('')

const checkPasscode = () => {
  if (!passcode.value.trim()) {
    errorMsg.value = 'Silakan masukkan passcode admin'
    return
  }

  if (passcode.value.trim() === ADMIN_PASSCODE) {
    sessionStorage.setItem('admin_authenticated', 'true')
    emit('authenticated')
    emit('close')
    passcode.value = ''
    errorMsg.value = ''
    router.push('/admin')
  } else {
    errorMsg.value = 'Passcode salah! Silakan coba lagi.'
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
    <div class="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden">
      <div class="p-6 text-center">
        <div class="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-8 ring-indigo-50/50">
          <ShieldCheck class="w-7 h-7" />
        </div>
        <h3 class="text-lg font-bold text-slate-800">Akses Portal Admin</h3>
        <p class="text-xs text-slate-500 mt-1">
          Masukkan kode sandi otorisasi admin untuk mengelola soal dan menilai ujian.
        </p>

        <form @submit.prevent="checkPasscode" class="mt-5 space-y-4 text-left">
          <div>
            <div class="relative">
              <input 
                v-model="passcode"
                type="password" 
                placeholder="Masukkan Passcode Admin..."
                autofocus
                class="w-full text-sm pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
              />
              <Lock class="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
            <p class="text-[11px] text-slate-400 mt-1 italic">
              Passcode default: <code class="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">admin123</code>
            </p>
          </div>

          <div v-if="errorMsg" class="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs">
            <AlertCircle class="w-4 h-4 flex-shrink-0" />
            <span>{{ errorMsg }}</span>
          </div>

          <div class="flex items-center gap-2 pt-2">
            <button 
              type="button" 
              @click="emit('close')"
              class="w-1/2 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button 
              type="submit" 
              class="w-1/2 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl transition-all shadow-md shadow-indigo-600/20"
            >
              Masuk
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
