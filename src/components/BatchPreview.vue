<script setup lang="ts">
import { ref } from 'vue'
import { useMockupStore } from '../stores/mockupStore'
import { Download, CheckCircle2, AlertCircle, Loader2, Layers } from 'lucide-vue-next'

const store = useMockupStore()
const isExporting = ref(false)

const INTERNAL_SIZE = 2000

const renderComposite = async (mockup: any, size: number): Promise<string | null> => {
  if (!mockup.boundary || !store.designSrc) return null

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const baseImg = new Image()
  baseImg.crossOrigin = 'anonymous'
  baseImg.src = mockup.src
  await new Promise<void>((r) => { baseImg.onload = () => r(); baseImg.onerror = () => r() })

  const imgScale = Math.min(INTERNAL_SIZE / baseImg.width, INTERNAL_SIZE / baseImg.height)
  const scale = size / INTERNAL_SIZE
  const dx = (INTERNAL_SIZE - baseImg.width * imgScale) / 2
  const dy = (INTERNAL_SIZE - baseImg.height * imgScale) / 2
  ctx.drawImage(baseImg, dx * scale, dy * scale, baseImg.width * imgScale * scale, baseImg.height * imgScale * scale)

  const designImg = new Image()
  designImg.crossOrigin = 'anonymous'
  designImg.src = store.designSrc
  await new Promise<void>((r) => { designImg.onload = () => r(); designImg.onerror = () => r() })

  const b = mockup.boundary!
  ctx.save()
  ctx.translate(b.x * scale, b.y * scale)
  ctx.rotate(b.rotation * Math.PI / 180)
  ctx.globalAlpha = 0.9
  if (store.multiplyBlend[mockup.id]) ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(designImg, 0, 0, b.width * scale, b.height * scale)
  ctx.restore()

  return canvas.toDataURL('image/png')
}

const exportToEtsy = async () => {
  if (!store.activeListing) return

  isExporting.value = true
  try {
    const images: { name: string; data: string }[] = []

    for (const mockup of store.exportMockups) {
      const dataUrl = await renderComposite(mockup, INTERNAL_SIZE)
      if (dataUrl) {
        images.push({ name: `Artboard_${mockup.name}`, data: dataUrl })
      }
    }

    const response = await fetch('/api/save-listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: store.activeListing.version,
        id: store.activeListing.id,
        images
      })
    })

    if (response.ok) {
      alert(`Successfully exported ${images.length} mockups to ${store.activeListing.version}/listing/`)
    }
  } catch (e) {
    console.error(e)
    alert('Export failed. Make sure the local server is configured.')
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="max-w-6xl mx-auto py-4">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h2 class="text-2xl font-bold text-white tracking-tight">Batch Export Gallery</h2>
        <p v-if="store.activeListing" class="text-indigo-400 text-sm mt-1 font-bold">
          Targeting: {{ store.activeListing.version }} / {{ store.activeListing.id }}
        </p>
        <p v-else class="text-slate-500 text-sm mt-1">Review and download all generated mockups.</p>
      </div>

      <div v-if="store.exportMockups.length > 0 && store.designSrc" class="flex items-center gap-4">
        <button
          v-if="store.activeListing"
          @click="exportToEtsy"
          :disabled="isExporting"
          class="flex items-center gap-2 px-6 py-3 bg-emerald-600 rounded-2xl font-bold shadow-xl shadow-emerald-600/20 hover:scale-105 transition-all text-sm disabled:opacity-50"
        >
          <Download v-if="!isExporting" class="w-4 h-4" />
          <Loader2 v-else class="w-4 h-4 animate-spin" />
          {{ isExporting ? 'Saving to Folder...' : `Export ${store.exportMockups.length} Mockups` }}
        </button>
      </div>
    </div>

    <div v-if="!store.designSrc" class="glass-panel p-20 flex flex-col items-center justify-center text-center gap-4">
      <Loader2 class="w-12 h-12 text-indigo-500 animate-spin" />
      <h3 class="text-xl font-bold text-slate-300">Awaiting Design</h3>
      <p class="text-slate-500 max-w-sm">Upload your design PNG in the sidebar to generate previews.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="mockup in store.exportMockups"
        :key="mockup.id"
        class="glass-panel group overflow-hidden flex flex-col"
      >
        <div class="aspect-square bg-slate-900 relative overflow-hidden">
          <img :src="mockup.src" class="w-full h-full object-contain" />

          <div v-if="mockup.boundary && store.designSrc"
               class="absolute inset-0 pointer-events-none overflow-hidden"
               :class="store.multiplyBlend[mockup.id] ? 'mix-blend-multiply' : ''">
            <div :style="{
              position: 'absolute',
              left: (mockup.boundary.x / INTERNAL_SIZE * 100) + '%',
              top: (mockup.boundary.y / INTERNAL_SIZE * 100) + '%',
              width: (mockup.boundary.width / INTERNAL_SIZE * 100) + '%',
              height: (mockup.boundary.height / INTERNAL_SIZE * 100) + '%',
              transform: `rotate(${mockup.boundary.rotation}deg)`,
              transformOrigin: '0 0'
            }">
              <img :src="store.designSrc" class="w-full h-full object-fill opacity-90" />
            </div>
          </div>

          <div v-if="!mockup.boundary" class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle class="w-8 h-8 text-amber-500 mb-2" />
            <p class="text-xs font-bold text-slate-300">NO BOUNDARIES SET</p>
            <p class="text-[10px] text-slate-500 mt-1">Visit the editor to define the design zone for this asset.</p>
          </div>
        </div>

        <div class="p-3 flex items-center justify-between border-t border-white/5">
          <span class="text-xs font-medium text-slate-400 truncate">{{ mockup.name }}</span>
          <div class="flex items-center gap-2">
            <!-- Per-mockup multiply toggle -->
            <button
              @click="store.toggleMultiply(mockup.id)"
              class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border"
              :class="store.multiplyBlend[mockup.id]
                ? 'bg-indigo-600/15 border-indigo-500/30 text-indigo-400'
                : 'bg-transparent border-white/5 text-slate-600 hover:text-slate-300 hover:border-white/10'"
            >
              <Layers class="w-3 h-3" />
              Multiply
            </button>
            <CheckCircle2 v-if="mockup.boundary" class="w-4 h-4 text-emerald-500 flex-shrink-0" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
