<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import Navbar from "./components/Navbar.vue";

const route = useRoute();
const currentYear = computed(() => new Date().getFullYear());
const showNavbar = computed(
  () => route.path.startsWith("/admin") || route.path === "/login",
);
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#f4f8fc]">
    <Navbar v-if="showNavbar" />

    <main class="flex-1">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <footer
      class="py-5 text-center text-xs text-slate-600 border-t border-slate-200/80 mt-auto bg-white/60 backdrop-blur-xs"
    >
      <div
        class="max-w-md mx-auto px-4 flex items-center justify-center text-xs sm:text-sm"
      >
        <span>
          &copy; {{ currentYear }} Made with 💖 by
          <a
            href="https://ditanrs.my.id"
            target="_blank"
            rel="noopener noreferrer"
            class="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors ml-1"
          >
            Ditss
          </a>
        </span>
      </div>
    </footer>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.12s ease;
}

.fade-enter-from {
  opacity: 0;
}

.fade-leave-to {
  opacity: 0;
}
</style>
