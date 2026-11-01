<script setup>
import { ref } from 'vue'
import { X, Database, Check, Key, Globe, AlertCircle, Copy, ExternalLink } from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close', 'saved'])

const url = ref(localStorage.getItem('custom_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '')
const anonKey = ref(localStorage.getItem('custom_supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '')
const successMsg = ref('')
const copied = ref(false)

const saveConfig = () => {
  if (url.value.trim()) {
    localStorage.setItem('custom_supabase_url', url.value.trim())
  } else {
    localStorage.removeItem('custom_supabase_url')
  }

  if (anonKey.value.trim()) {
    localStorage.setItem('custom_supabase_key', anonKey.value.trim())
  } else {
    localStorage.removeItem('custom_supabase_key')
  }

  successMsg.value = 'Pengaturan berhasil disimpan. Memuat ulang...'
  setTimeout(() => {
    window.location.reload()
  }, 800)
}

const copySqlSchema = () => {
  const schemaText = `-- Tambahkan kolom quiz_date untuk fitur kuis harian otomatis
alter table public.questions add column if not exists quiz_date date not null default current_date;
alter table public.participants add column if not exists quiz_date date not null default current_date;
create index if not exists idx_questions_quiz_date on public.questions(quiz_date);
create index if not exists idx_participants_date on public.participants(quiz_date);`

  navigator.clipboard.writeText(schemaText)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
    <div class="bg-white rounded-2xl w-full max-w-md shadow-xl border border-blue-100 overflow-hidden">
      <!-- Header -->
      <div class="px-5 py-4 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Database class="w-4 h-4 text-blue-600" />
          <h3 class="font-bold text-sm text-slate-800">Koneksi Database Supabase</h3>
        </div>
        <button @click="emit('close')" class="p-1 rounded text-slate-400 hover:text-slate-700">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-5 space-y-3.5">
        <div class="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2">
          <AlertCircle class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p>
            Dapatkan Project URL & Anon Key dari menu <strong>Project Settings -> API</strong> pada dashboard Supabase Anda.
          </p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Globe class="w-3.5 h-3.5 text-blue-500" />
            Project URL Supabase
          </label>
          <input 
            v-model="url"
            type="text" 
            placeholder="https://xyzcompany.supabase.co"
            class="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-800"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Key class="w-3.5 h-3.5 text-blue-500" />
            Anon Public Key
          </label>
          <textarea 
            v-model="anonKey"
            rows="3"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            class="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-800"
          ></textarea>
        </div>

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <button 
            type="button"
            @click="copySqlSchema"
            class="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5"
          >
            <Copy class="w-3.5 h-3.5" />
            <span>{{ copied ? 'Tersalin!' : 'Salin Script Migrasi Tanggal' }}</span>
          </button>

          <a 
            href="https://supabase.com/dashboard" 
            target="_blank" 
            class="text-slate-500 hover:text-blue-600 flex items-center gap-1 font-medium"
          >
            Buka Supabase <ExternalLink class="w-3 h-3" />
          </a>
        </div>

        <div v-if="successMsg" class="p-2.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg text-center font-medium">
          {{ successMsg }}
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
        <button 
          @click="emit('close')"
          type="button"
          class="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg"
        >
          Tutup
        </button>
        <button 
          @click="saveConfig"
          type="button"
          class="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-xs"
        >
          <Check class="w-3.5 h-3.5" />
          Simpan Pengaturan
        </button>
      </div>
    </div>
  </div>
</template>
