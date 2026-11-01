<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { LogOut, Calendar } from 'lucide-vue-next'
import { getTodayDateString, formatIndonesianDate } from '../lib/supabase'

const router = useRouter()
const route = useRoute()

const isAdminPage = computed(() => route.path.startsWith('/admin') || route.path.startsWith('/login'))
const isAuthenticatedAdmin = computed(() => !!sessionStorage.getItem('admin_authenticated'))

const todayFormatted = computed(() => {
  return formatIndonesianDate(getTodayDateString())
})

const handleLogout = () => {
  sessionStorage.removeItem('admin_authenticated')
  router.push('/')
}
</script>

<template>
  <header class="bg-white/90 backdrop-blur-md border-b border-blue-100/80 sticky top-0 z-30 shadow-2xs">
    <div class="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
      <!-- Title / Brand with Larger Transparent Logo -->
      <router-link to="/" class="flex items-center gap-2 group py-1">
        <img 
          src="/logo.png" 
          alt="Quiz" 
          class="h-9 sm:h-10 w-auto object-contain transition-transform group-hover:scale-105 select-none" 
        />
      </router-link>

      <!-- Right items -->
      <div class="flex items-center gap-2">
        <!-- Date indicator for users -->
        <div v-if="!isAdminPage" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100/90 shadow-2xs">
          <Calendar class="w-3.5 h-3.5 text-blue-500" />
          <span class="hidden sm:inline">{{ todayFormatted }}</span>
          <span class="sm:hidden">Hari Ini</span>
        </div>

        <!-- Admin Logout -->
        <button
          v-if="isAdminPage && isAuthenticatedAdmin"
          @click="handleLogout"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Keluar dari Panel Pengelola"
        >
          <LogOut class="w-3.5 h-3.5" />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  </header>
</template>
