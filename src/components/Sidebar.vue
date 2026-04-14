<script setup lang="ts">
import { ref } from 'vue'
import { useMockupStore } from '../stores/mockupStore'
import { Plus, Upload, Trash2, Image as ImageIcon, Sparkles, Check } from 'lucide-vue-next'

const props = defineProps<{ activeTab: string }>()
const store = useMockupStore()
const isDraggingDesign = ref(false)
const isDraggingMockup = ref(false)

const processMockupFiles = (files: FileList) => {
  for (const file of files) {
    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        store.addMockup(event.target.result as string, file.name)
      }
    }
    reader.readAsDataURL(file)
  }
}

const handleMockupUpload = (e: Event) => {
  const files = (e.target as HTMLInputElement).files
  if (files) processMockupFiles(files)
}

const handleMockupDrop = (e: DragEvent) => {
    isDraggingMockup.value = false
    const files = e.dataTransfer?.files
    if (files) processMockupFiles(files)
}

const processDesignFile = (file: File) => {
  const reader = new FileReader()
  reader.onload = (event) => {
    if (event.target?.result) {
      store.setDesign(event.target.result as string)
    }
  }
  reader.readAsDataURL(file)
}

const handleDesignUpload = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) processDesignFile(file)
}

const handleDesignDrop = (e: DragEvent) => {
    isDraggingDesign.value = false
    const file = e.dataTransfer?.files[0]
    if (file) processDesignFile(file)
}
</script>

<template>
  <aside class="w-80 h-full border-r border-white/5 flex flex-col bg-slate-950/80 backdrop-blur-3xl z-30">
    <div class="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
      
      <!-- Design Upload -->
      <section>
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Sparkles class="w-3 h-3" /> Design Source
        </h3>
        <div 
            @dragover.prevent="isDraggingDesign = true"
            @dragleave.prevent="isDraggingDesign = false"
            @drop.prevent="handleDesignDrop"
            class="glass-card p-4 border-dashed transition-all duration-300 relative overflow-hidden group"
            :class="[
                isDraggingDesign ? 'border-indigo-500 scale-[1.02] bg-indigo-500/5' : 'border-white/10',
                store.designSrc ? 'aspect-square' : ''
            ]"
        >
          <input type="file" @change="handleDesignUpload" class="absolute inset-0 opacity-0 cursor-pointer z-10" accept="image/*" title="" />
          
          <div v-if="!store.designSrc" class="flex flex-col items-center justify-center h-full py-4 text-center">
            <Upload class="w-8 h-8 text-slate-600 mb-2 group-hover:text-indigo-400 transition-colors" />
            <p class="text-[10px] text-slate-400 font-medium">DROP PNG HERE</p>
          </div>
          
          <div v-else class="w-full h-full relative">
             <img :src="store.designSrc" class="w-full h-full object-contain p-2" />
             <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                <span class="text-[9px] font-bold text-white bg-indigo-600 px-2 py-0.5 rounded">REPLACE</span>
             </div>
          </div>
        </div>
      </section>

      <!-- Mockup Management -->
      <section class="flex-1 flex flex-col pb-10">
        <div class="flex items-center justify-between mb-3 px-1">
          <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <ImageIcon class="w-3 h-3" /> Mockup Lib
          </h3>
          <div class="flex items-center gap-1">
            <!-- Select all / none (visible on batch export tab) -->
            <template v-if="props.activeTab === 'preview'">
              <button @click="store.selectAllExport()" class="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors">ALL</button>
              <button @click="store.deselectAllExport()" class="text-[9px] font-bold text-slate-500 hover:text-slate-300 px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors">NONE</button>
            </template>
            <label class="p-1 hover:bg-white/5 rounded cursor-pointer transition-colors text-indigo-400">
              <input type="file" multiple @change="handleMockupUpload" class="hidden" accept="image/*" />
              <Plus class="w-4 h-4" />
            </label>
          </div>
        </div>

        <!-- Export count badge (batch tab) -->
        <div v-if="props.activeTab === 'preview' && store.configuredCount > 0" class="mb-2 px-1">
          <span class="text-[10px] font-bold text-emerald-400">
            {{ store.exportSelectedCount }} / {{ store.configuredCount }} selected for export
          </span>
        </div>

        <div
            @dragover.prevent="isDraggingMockup = true"
            @dragleave.prevent="isDraggingMockup = false"
            @drop.prevent="handleMockupDrop"
            class="flex-1 min-h-[100px] flex flex-col gap-2 rounded-2xl border transition-all"
            :class="isDraggingMockup ? 'border-indigo-500/50 bg-indigo-500/5 p-2' : 'border-transparent'"
        >
            <div v-if="store.mockups.length === 0" class="flex-1 flex flex-col items-center justify-center opacity-40 border border-dashed border-white/5 rounded-2xl p-6 text-center">
                 <p class="text-[11px] font-medium text-slate-500 italic">Drop shirt mockups here to start bulk editing</p>
            </div>

            <div
                v-for="(mockup, index) in store.mockups"
                :key="mockup.id"
                @click="store.selectedIndex = index"
                class="group p-2.5 rounded-xl flex items-center gap-3 transition-all cursor-pointer border border-transparent"
                :class="store.selectedIndex === index ? 'bg-indigo-600/10 border-indigo-500/30' : 'hover:bg-white/5'"
            >
                <!-- Export checkbox (shown on batch export tab) -->
                <button
                    v-if="props.activeTab === 'preview'"
                    @click.stop="mockup.boundary && store.toggleExport(mockup.id)"
                    class="flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
                    :class="!mockup.boundary
                      ? 'border-slate-700 bg-slate-800 cursor-not-allowed opacity-30'
                      : store.exportSelection[mockup.id] !== false
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-600 hover:border-slate-400'"
                >
                    <Check v-if="mockup.boundary && store.exportSelection[mockup.id] !== false" class="w-3 h-3" />
                </button>

                <div class="w-12 h-12 rounded-lg bg-slate-900 border border-white/5 overflow-hidden flex-shrink-0 relative">
                    <img :src="mockup.src" class="w-full h-full object-contain" />
                    <div v-if="mockup.boundary && store.designSrc"
                         class="absolute inset-0 pointer-events-none overflow-hidden"
                         :class="store.multiplyBlend[mockup.id] ? 'mix-blend-multiply' : ''">
                        <div :style="{
                            position: 'absolute',
                            left: (mockup.boundary.x / 2000 * 100) + '%',
                            top: (mockup.boundary.y / 2000 * 100) + '%',
                            width: (mockup.boundary.width / 2000 * 100) + '%',
                            height: (mockup.boundary.height / 2000 * 100) + '%',
                            transform: `rotate(${mockup.boundary.rotation}deg)`,
                            transformOrigin: '0 0'
                        }">
                            <img :src="store.designSrc" class="w-full h-full object-fill opacity-90" />
                        </div>
                    </div>
                    <div v-else-if="mockup.boundary" class="absolute inset-0 bg-emerald-500/20"></div>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-[11px] font-bold text-slate-300 truncate">{{ mockup.name }}</p>
                    <p class="text-[9px] font-medium tracking-wide uppercase" :class="mockup.boundary ? 'text-emerald-500' : 'text-slate-600'">
                        {{ mockup.boundary ? 'Configured' : 'No Area Set' }}
                    </p>
                </div>
                <button @click.stop="store.deleteMockup(index)" class="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all">
                    <Trash2 class="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
      </section>
    </div>
  </aside>
</template>
