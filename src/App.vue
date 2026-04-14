<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import CanvasWorkspace from './components/CanvasWorkspace.vue'
import BatchPreview from './components/BatchPreview.vue'
import EtsyLibrary from './components/EtsyLibrary.vue'
import { useMockupStore } from './stores/mockupStore'
import { Layers, Image as ImageIcon, Sparkles, Download } from 'lucide-vue-next'

const store = useMockupStore()
const activeTab = ref<'editor' | 'preview' | 'etsy'>('editor')

onMounted(() => {
  store.init()
})
</script>

<template>
  <div class="flex h-screen w-full bg-slate-950 overflow-hidden font-outfit selection:bg-indigo-500/20">
    <!-- Sidebar -->
    <Sidebar :activeTab="activeTab" />

    <!-- Main Content Area -->
    <main class="flex-1 flex flex-col relative min-w-0">
      <!-- Header -->
      <header class="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-slate-950/50 backdrop-blur-md z-20">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Layers class="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 class="text-lg font-bold tracking-tight">Etsy Helper</h1>
            <p class="text-[10px] text-slate-500 font-medium uppercase tracking-[0.2em]">Engine v1.0.4</p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <button 
            @click="activeTab = 'editor'"
            class="px-4 py-1.5 rounded-lg text-sm transition-all"
            :class="activeTab === 'editor' ? 'bg-white/10 text-white font-medium shadow-inner border border-white/5' : 'text-slate-400 hover:text-white'"
          >
            Design Engine
          </button>
          <button 
            @click="activeTab = 'etsy'"
            class="px-4 py-1.5 rounded-lg text-sm transition-all"
            :class="activeTab === 'etsy' ? 'bg-indigo-600/10 text-indigo-400 font-bold border border-indigo-500/20' : 'text-slate-400 hover:text-white'"
          >
            Etsy Library
          </button>
          <button 
            @click="activeTab = 'preview'"
            class="px-4 py-1.5 rounded-lg text-sm transition-all"
            :class="activeTab === 'preview' ? 'bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white'"
          >
            Batch Export
          </button>
        </div>
      </header>

      <!-- Viewport -->
      <div class="flex-1 relative overflow-hidden flex">
        <Transition name="fade-slide">
          <div v-if="activeTab === 'editor'" class="w-full h-full p-6">
             <CanvasWorkspace />
          </div>
          <div v-else-if="activeTab === 'etsy'" class="w-full h-full p-6 overflow-y-auto">
             <EtsyLibrary v-model:activeTab="activeTab" />
          </div>
          <div v-else class="w-full h-full p-6 overflow-y-auto">
             <BatchPreview />
          </div>
        </Transition>
      </div>

      <!-- Footer / Status -->
      <footer class="h-10 px-6 flex items-center justify-between text-[11px] text-slate-500 border-t border-white/5 z-20">
        <div class="flex items-center gap-4">
          <span class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            System Ready
          </span>
          <span class="text-slate-700">|</span>
          <span>{{ store.mockups.length }} Mockups Configured</span>
        </div>
        <div>
          Powered by Antigravity Vector Engine
        </div>
      </footer>
    </main>
  </div>
</template>

<style>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  position: absolute;
  width: 100%;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.font-outfit {
  font-family: 'Outfit', sans-serif;
}
</style>
