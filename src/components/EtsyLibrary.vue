<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useMockupStore } from '../stores/mockupStore'
import { ExternalLink, FolderOpen, Search, Filter, Grid, List, Image as ImageIcon, Sparkles } from 'lucide-vue-next'

interface EtsyDesign {
  id: string
  version: string
  designPath: string
  mockups: string[]
  etsyLink: string
}

const props = defineProps(['activeTab'])
const emit = defineEmits(['update:activeTab'])

const store = useMockupStore()
const designs = ref<EtsyDesign[]>([])
const searchQuery = ref('')
const viewMode = ref<'grid' | 'table'>('grid')
const selectedDesign = ref<EtsyDesign | null>(null)

const startMockupJob = (design: EtsyDesign) => {
  store.setDesign(design.designPath)
  store.activeListing = { id: design.id, version: design.version }
  emit('update:activeTab', 'editor')
}

// Load the generated manifest
onMounted(async () => {
  try {
    // In a real environment, this would be a fetch or import
    const response = await fetch('/src/assets/etsy-designs.json')
    if (response.ok) {
        designs.value = await response.json()
    }
  } catch (e) {
    console.error('Manifest not found. Please run: npm run sync')
  }
})

const filteredDesigns = computed(() => {
  return designs.value.filter(d => 
    d.id.includes(searchQuery.value) || 
    d.version.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const openEtsyListing = (link: string) => {
  window.open(link, '_blank')
}
</script>

<template>
  <div class="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
    <!-- Filters & Stats -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-4">
      <div class="flex items-center gap-3">
        <div class="relative group">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Search Listing ID or Version..." 
            class="input-field !pl-10 !py-2 !w-64"
          />
        </div>
        <div class="px-3 py-1 bg-white/5 rounded-lg border border-white/5 flex items-center gap-2">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-tighter">Total</span>
            <span class="text-indigo-400 font-bold font-mono">{{ filteredDesigns.length }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button 
            @click="viewMode = 'grid'"
            class="p-2 rounded-lg transition-all"
            :class="viewMode === 'grid' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:text-white hover:bg-white/5'"
        >
            <Grid class="w-4 h-4" />
        </button>
        <button 
            @click="viewMode = 'table'"
            class="p-2 rounded-lg transition-all"
            :class="viewMode === 'table' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:text-white hover:bg-white/5'"
        >
            <List class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="designs.length === 0" class="glass-panel p-20 flex flex-col items-center justify-center text-center space-y-4">
        <div class="w-16 h-16 rounded-3xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <FolderOpen class="w-8 h-8 text-amber-500" />
        </div>
        <div class="max-w-md">
            <h3 class="text-xl font-bold text-white">No Etsy Data Found</h3>
            <p class="text-slate-400 text-sm mt-2 mb-6">You need to index your local Etsy folder first. Open your terminal and run the sync command inside the project folder:</p>
            <code class="bg-black/50 p-3 rounded-xl border border-white/5 text-indigo-300 font-mono text-xs block mb-6">
                npm run sync
            </code>
            <p class="text-[10px] text-slate-500 italic">This will scan your folders and build the design catalog.</p>
        </div>
    </div>

    <!-- Grid View -->
    <div v-else-if="viewMode === 'grid'" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
       <div 
         v-for="design in filteredDesigns" 
         :key="design.id"
         class="glass-panel group overflow-hidden flex flex-col hover:border-indigo-500/30 transition-all hover:-translate-y-1"
       >
          <div class="aspect-square bg-slate-900 relative overflow-hidden">
             <!-- Thumbnail -->
             <img :src="design.designPath" class="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500" />
             
             <!-- Badge -->
             <div class="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10">
                <span class="text-[10px] font-bold text-slate-300">{{ design.version }}</span>
             </div>

             <!-- Quick Actions Overlay -->
             <div class="absolute inset-0 bg-indigo-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 px-4">
                <button 
                    @click="startMockupJob(design)"
                    class="w-full btn-primary !py-1.5 !text-[10px] bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40"
                >
                    <Sparkles class="w-3.5 h-3.5" /> Create Mockups
                </button>
                <button 
                    @click="openEtsyListing(design.etsyLink)"
                    class="w-full btn-secondary !py-1.5 !text-[10px]"
                >
                    <ExternalLink class="w-3.5 h-3.5" /> View on Etsy
                </button>
                <button 
                   v-if="design.mockups.length > 0"
                    @click="selectedDesign = design"
                    class="btn-secondary !py-1.5 !px-4 !text-[10px]"
                >
                    <ImageIcon class="w-3.5 h-3.5" /> Completed Jobs
                </button>
             </div>
          </div>
          
          <div class="p-3 border-t border-white/5 space-y-1">
             <h4 class="text-xs font-bold text-white tracking-widest">{{ design.id }}</h4>
             <p class="text-[10px] text-slate-500 flex items-center gap-1.5">
                <span v-if="design.mockups.length > 0" class="flex items-center gap-1 text-emerald-500">
                    <span class="w-1 h-1 rounded-full bg-emerald-500"></span> {{ design.mockups.length }} Mockups
                </span>
                <span v-else class="text-slate-600 italic">Design only</span>
             </p>
          </div>
       </div>
    </div>

    <!-- Table View -->
    <div v-else class="glass-panel overflow-hidden">
        <table class="w-full text-left">
            <thead class="bg-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <tr>
                    <th class="px-6 py-4">Preview</th>
                    <th class="px-6 py-4">Listing ID</th>
                    <th class="px-6 py-4">Version</th>
                    <th class="px-6 py-4">Job Status</th>
                    <th class="px-6 py-4 text-right">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
                <tr v-for="design in filteredDesigns" :key="design.id" class="hover:bg-white/5 transition-colors group">
                    <td class="px-6 py-4">
                        <img :src="design.designPath" class="w-12 h-12 rounded bg-slate-900 object-contain p-1 border border-white/5" />
                    </td>
                    <td class="px-6 py-4 font-mono text-xs text-indigo-400 font-bold">{{ design.id }}</td>
                    <td class="px-6 py-4 text-xs font-medium text-slate-300">{{ design.version }}</td>
                    <td class="px-6 py-4">
                        <span v-if="design.mockups.length > 0" class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20">
                            DONE ({{ design.mockups.length }} FILES)
                        </span>
                        <span v-else class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-800 text-slate-500 text-[10px] font-bold rounded-full border border-white/5">
                            PENDING
                        </span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex items-center justify-end gap-2">
                             <button @click="startMockupJob(design)" class="p-2 hover:bg-emerald-600/20 rounded-lg text-slate-400 hover:text-emerald-400 transition-all" title="Create Mockups">
                                <Sparkles class="w-4 h-4" />
                             </button>
                             <button @click="openEtsyListing(design.etsyLink)" class="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all" title="View Listing">
                                <ExternalLink class="w-4 h-4" />
                             </button>
                             <button v-if="design.mockups.length > 0" @click="selectedDesign = design" class="p-2 hover:bg-indigo-600/20 rounded-lg text-slate-400 hover:text-indigo-400 transition-all" title="View Mockups">
                                <ImageIcon class="w-4 h-4" />
                             </button>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Mockup Viewer Modal -->
    <div v-if="selectedDesign" class="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-slate-950/90 backdrop-blur-md animate-in fade-in zoom-in duration-300">
        <div class="glass-panel w-full max-w-5xl max-h-full flex flex-col overflow-hidden relative border-indigo-500/30">
            <header class="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-white/5">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-lg bg-slate-900 p-1 border border-white/10">
                        <img :src="selectedDesign.designPath" class="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h3 class="font-bold text-white tracking-wide">Listing Job: {{ selectedDesign.id }}</h3>
                        <p class="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{{ selectedDesign.version }} / listings</p>
                    </div>
                </div>
                <button @click="selectedDesign = null" class="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </header>
            
            <main class="flex-1 p-8 overflow-y-auto bg-slate-950/50">
                <div class="grid grid-cols-2 lg:grid-cols-3 gap-6">
                    <div v-for="(url, idx) in selectedDesign.mockups" :key="idx" class="glass-card overflow-hidden group">
                        <div class="aspect-square bg-slate-900/40 relative">
                             <img :src="url" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                             <div class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                <span class="text-[10px] font-mono text-slate-400">{{ url.split('/').pop() }}</span>
                             </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>
  </div>
</template>
