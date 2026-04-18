<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useMockupStore } from '../stores/mockupStore'
import { Download, CheckCircle2, AlertCircle, Loader2, Layers } from 'lucide-vue-next'

const store = useMockupStore()
const isExporting = ref(false)
const exportBaseName = ref('')

// Default the name from the design source or active listing
watch(() => [store.designSrc, store.activeListing], () => {
  if (exportBaseName.value) return // don't overwrite user edits
  if (store.activeListing) {
    exportBaseName.value = store.activeListing.id
  } else if (store.designSrc) {
    // Extract filename from data URL or path
    const src = store.designSrc
    if (src.startsWith('data:')) {
      exportBaseName.value = 'design'
    } else {
      const name = src.split('/').pop()?.replace(/\.[^.]+$/, '') || 'design'
      exportBaseName.value = name
    }
  }
}, { immediate: true })

const getMockupExportName = (index: number) => {
  const base = exportBaseName.value.trim() || 'mockup'
  return `${base} ${index + 1}`
}

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

  // Draw text overlays
  const texts = store.textOverlays[mockup.id] || []
  for (const t of texts) {
    ctx.save()
    const fontParts = []
    if (t.italic) fontParts.push('italic')
    if (t.bold) fontParts.push('bold')
    fontParts.push(`${t.fontSize * scale}px`)
    fontParts.push(t.fontFamily)
    ctx.font = fontParts.join(' ')
    ctx.textBaseline = 'top'
    if (t.highlight) {
      ctx.fillStyle = t.highlight
      const metrics = ctx.measureText(t.text)
      const pad = 2 * scale
      ctx.fillRect(
        t.x * scale - pad, t.y * scale - pad,
        metrics.width + pad * 2, t.fontSize * scale * 1.2 + pad * 2
      )
    }
    ctx.fillStyle = t.color
    ctx.fillText(t.text, t.x * scale, t.y * scale)
    ctx.restore()
  }

  // Draw image overlays
  const images = store.imageOverlays[mockup.id] || []
  for (const img of images) {
    const overlayImg = new Image()
    overlayImg.crossOrigin = 'anonymous'
    overlayImg.src = img.src
    await new Promise<void>((r) => { overlayImg.onload = () => r(); overlayImg.onerror = () => r() })
    ctx.drawImage(overlayImg, img.x * scale, img.y * scale, img.width * scale, img.height * scale)
  }

  return canvas.toDataURL('image/jpeg', 0.92)
}

const dataUrlToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bytes = atob(parts[1])
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

const exportMockups = async () => {
  // Check browser support
  if (!(window as any).showDirectoryPicker) {
    alert('Your browser does not support folder picker. Please use Chrome or Edge.')
    return
  }

  let dirHandle: any
  try {
    dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
  } catch (e: any) {
    if (e.name !== 'AbortError') console.error('Folder picker error:', e)
    return
  }

  isExporting.value = true
  try {
    let count = 0
    for (let i = 0; i < store.exportMockups.length; i++) {
      const mockup = store.exportMockups[i]
      const dataUrl = await renderComposite(mockup, INTERNAL_SIZE)
      if (!dataUrl) continue

      const fileName = getMockupExportName(i).replace(/[\/\\:*?"<>|]/g, '_') + '.jpg'
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(dataUrlToBlob(dataUrl))
      await writable.close()
      count++
    }
    alert(`Successfully exported ${count} mockups!`)
  } catch (e) {
    console.error('Export error:', e)
    alert('Export failed: ' + (e as Error).message)
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
        <div class="flex flex-col items-end gap-1">
          <label class="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Export Name</label>
          <input
            v-model="exportBaseName"
            placeholder="design name"
            class="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-white w-52 focus:outline-none focus:border-indigo-500/50 text-right"
          />
        </div>
        <button
          @click="exportMockups"
          :disabled="isExporting"
          class="flex items-center gap-2 px-6 py-3 bg-emerald-600 rounded-2xl font-bold shadow-xl shadow-emerald-600/20 hover:scale-105 transition-all text-sm disabled:opacity-50"
        >
          <Download v-if="!isExporting" class="w-4 h-4" />
          <Loader2 v-else class="w-4 h-4 animate-spin" />
          {{ isExporting ? 'Saving...' : `Export ${store.exportMockups.length} Mockups` }}
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
        v-for="(mockup, idx) in store.exportMockups"
        :key="mockup.id"
        class="glass-panel group overflow-hidden flex flex-col"
      >
        <div class="aspect-square bg-slate-900 relative overflow-hidden" style="container-type: inline-size">
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

          <!-- Text overlays preview -->
          <div v-for="t in (store.textOverlays[mockup.id] || [])" :key="t.id"
               class="absolute pointer-events-none"
               :style="{
                 left: (t.x / INTERNAL_SIZE * 100) + '%',
                 top: (t.y / INTERNAL_SIZE * 100) + '%',
                 fontSize: (t.fontSize / INTERNAL_SIZE * 100) + 'cqw',
                 fontFamily: t.fontFamily,
                 fontWeight: t.bold ? 'bold' : 'normal',
                 fontStyle: t.italic ? 'italic' : 'normal',
                 color: t.color,
                 backgroundColor: t.highlight || 'transparent',
                 whiteSpace: 'nowrap',
                 lineHeight: '1.2',
               }">{{ t.text }}</div>

          <!-- Image overlays preview -->
          <img v-for="img in (store.imageOverlays[mockup.id] || [])" :key="img.id"
               :src="img.src"
               class="absolute pointer-events-none object-contain"
               :style="{
                 left: (img.x / INTERNAL_SIZE * 100) + '%',
                 top: (img.y / INTERNAL_SIZE * 100) + '%',
                 width: (img.width / INTERNAL_SIZE * 100) + '%',
                 height: (img.height / INTERNAL_SIZE * 100) + '%',
               }" />

          <div v-if="!mockup.boundary" class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle class="w-8 h-8 text-amber-500 mb-2" />
            <p class="text-xs font-bold text-slate-300">NO BOUNDARIES SET</p>
            <p class="text-[10px] text-slate-500 mt-1">Visit the editor to define the design zone for this asset.</p>
          </div>
        </div>

        <div class="p-3 flex items-center justify-between border-t border-white/5">
          <span class="text-xs font-medium text-slate-400 truncate">{{ getMockupExportName(idx) }}.jpg</span>
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
