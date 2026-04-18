<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useMockupStore, type TextOverlay, type ImageOverlay } from '../stores/mockupStore'
import { Save, Layout, RotateCw, Type, Bold, Italic, Trash2, ImagePlus } from 'lucide-vue-next'

const store = useMockupStore()
const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLDivElement | null>(null)
const textEditRef = ref<HTMLInputElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)

const INTERNAL_SIZE = 2000
const ZONE_RATIO = 5 / 6 // 4500:5400

const FONTS = [
  'Outfit', 'Montserrat', 'Playfair Display', 'Oswald',
  'Bebas Neue', 'Lobster', 'Pacifico', 'Dancing Script',
  'Arial', 'Georgia', 'Times New Roman'
]

const DEFAULT_ZONE = { x: 700, y: 540, width: 600, height: 720, rotation: 0 }
const rectData = ref({ ...DEFAULT_ZONE })

const containerSize = ref({ width: 800, height: 600 })
const mockupInfo = ref({ x: 0, y: 0, width: 2000, height: 2000 })
const mockupLoaded = ref(false)
const editingTextId = ref<string | null>(null)

// Scale: screen px per internal unit
const sc = computed(() => {
  const sz = Math.min(containerSize.value.width, containerSize.value.height) * 0.95
  return sz / INTERNAL_SIZE
})

const canvasStyle = computed(() => {
  const sz = sc.value * INTERNAL_SIZE
  return {
    width: `${sz}px`,
    height: `${sz}px`,
    left: `${(containerSize.value.width - sz) / 2}px`,
    top: `${(containerSize.value.height - sz) / 2}px`
  }
})

const mockupImgStyle = computed(() => {
  const s = sc.value, m = mockupInfo.value
  return {
    left: `${m.x * s}px`,  top: `${m.y * s}px`,
    width: `${m.width * s}px`, height: `${m.height * s}px`
  }
})

const zoneStyle = computed(() => {
  const s = sc.value, r = rectData.value
  return {
    left: `${r.x * s}px`, top: `${r.y * s}px`,
    width: `${r.width * s}px`, height: `${r.height * s}px`,
    transform: `rotate(${r.rotation}deg)`,
    transformOrigin: '0 0'
  }
})

// ── Text overlays ──
const currentTexts = computed(() => {
  const mockup = store.currentMockup
  if (!mockup) return []
  return store.textOverlays[mockup.id] || []
})

const selectedText = computed(() => {
  if (!store.selectedTextId) return null
  return currentTexts.value.find(t => t.id === store.selectedTextId) || null
})

const getTextStyle = (t: TextOverlay) => {
  const s = sc.value
  return {
    left: `${t.x * s}px`,
    top: `${t.y * s}px`,
    fontSize: `${t.fontSize * s}px`,
    fontFamily: t.fontFamily,
    fontWeight: t.bold ? 'bold' : 'normal',
    fontStyle: t.italic ? 'italic' : 'normal',
    color: t.color,
    backgroundColor: t.highlight || 'transparent',
    padding: `${2 * s}px ${4 * s}px`,
    whiteSpace: 'nowrap',
    lineHeight: '1.2',
    outline: store.selectedTextId === t.id ? '2px solid rgba(129,140,248,0.7)' : 'none',
    outlineOffset: `${3 * s}px`,
  }
}

const updateSelected = (key: keyof TextOverlay, value: any) => {
  if (!store.selectedTextId) return
  store.updateTextOverlay(store.selectedTextId, { [key]: value })
}

const startTextEdit = (t: TextOverlay) => {
  store.selectedTextId = t.id
  editingTextId.value = t.id
  nextTick(() => textEditRef.value?.focus())
}

const finishTextEdit = (t: TextOverlay, e: Event) => {
  const val = (e.target as HTMLInputElement).value.trim()
  if (val) store.updateTextOverlay(t.id, { text: val })
  editingTextId.value = null
}

// ── Text drag ──
const startTextDrag = (e: PointerEvent, t: TextOverlay) => {
  if (editingTextId.value === t.id) return
  store.selectedTextId = t.id
  store.selectedImageId = null
  e.preventDefault()
  const s = sc.value
  const sx = e.clientX, sy = e.clientY
  const ox = t.x, oy = t.y
  const onMove = (me: PointerEvent) => {
    store.updateTextOverlay(t.id, {
      x: ox + (me.clientX - sx) / s,
      y: oy + (me.clientY - sy) / s
    })
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

const deselectAll = () => {
  store.selectedTextId = null
  store.selectedImageId = null
  editingTextId.value = null
}

// ── Image overlays ──
const currentImages = computed(() => {
  const mockup = store.currentMockup
  if (!mockup) return []
  return store.imageOverlays[mockup.id] || []
})

const selectedImage = computed(() => {
  if (!store.selectedImageId) return null
  return currentImages.value.find(i => i.id === store.selectedImageId) || null
})

const getImageStyle = (img: ImageOverlay) => {
  const s = sc.value
  return {
    left: `${img.x * s}px`,
    top: `${img.y * s}px`,
    width: `${img.width * s}px`,
    height: `${img.height * s}px`,
    outline: store.selectedImageId === img.id ? '2px solid rgba(129,140,248,0.7)' : 'none',
    outlineOffset: `${3 * s}px`,
  }
}

const handleImageUpload = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    const src = ev.target?.result as string
    const img = new Image()
    img.onload = () => {
      store.addImageOverlay(src, img.width, img.height)
    }
    img.src = src
  }
  reader.readAsDataURL(file)
  ;(e.target as HTMLInputElement).value = ''
}

const startImageDrag = (e: PointerEvent, img: ImageOverlay) => {
  if ((e.target as HTMLElement).dataset.imghandle) return
  store.selectedImageId = img.id
  store.selectedTextId = null
  e.preventDefault()
  const s = sc.value
  const sx = e.clientX, sy = e.clientY
  const ox = img.x, oy = img.y
  const onMove = (me: PointerEvent) => {
    store.updateImageOverlay(img.id, {
      x: ox + (me.clientX - sx) / s,
      y: oy + (me.clientY - sy) / s
    })
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

const startImageResize = (e: PointerEvent, img: ImageOverlay, corner: string) => {
  e.preventDefault()
  e.stopPropagation()
  const s = sc.value
  const aspect = img.width / img.height
  const startX = e.clientX, startY = e.clientY
  const ow = img.width, oh = img.height, ox = img.x, oy = img.y

  const onMove = (me: PointerEvent) => {
    const dx = (me.clientX - startX) / s
    const dy = (me.clientY - startY) / s
    let nw = ow, nh = oh, nx = ox, ny = oy

    if (corner === 'br') {
      nw = Math.max(40, ow + dx)
      nh = nw / aspect
    } else if (corner === 'bl') {
      nw = Math.max(40, ow - dx)
      nh = nw / aspect
      nx = ox + (ow - nw)
    } else if (corner === 'tr') {
      nw = Math.max(40, ow + dx)
      nh = nw / aspect
      ny = oy + (oh - nh)
    } else if (corner === 'tl') {
      nw = Math.max(40, ow - dx)
      nh = nw / aspect
      nx = ox + (ow - nw)
      ny = oy + (oh - nh)
    }
    store.updateImageOverlay(img.id, { x: nx, y: ny, width: nw, height: nh })
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

const updateContainerSize = () => {
  if (!containerRef.value) return
  containerSize.value = {
    width: containerRef.value.clientWidth,
    height: containerRef.value.clientHeight
  }
}

// ── Load mockup ──
watch(() => store.currentMockup?.src, (newSrc) => {
  if (!newSrc) { mockupLoaded.value = false; return }
  store.selectedTextId = null
  store.selectedImageId = null
  editingTextId.value = null
  const img = new Image()
  img.onload = () => {
    const s = Math.min(INTERNAL_SIZE / img.width, INTERNAL_SIZE / img.height)
    mockupInfo.value = {
      x: (INTERNAL_SIZE - img.width * s) / 2,
      y: (INTERNAL_SIZE - img.height * s) / 2,
      width: img.width * s, height: img.height * s
    }
    rectData.value = store.currentMockup?.boundary
      ? { ...store.currentMockup.boundary }
      : { ...DEFAULT_ZONE }
    mockupLoaded.value = true
  }
  img.src = newSrc
}, { immediate: true })

// ══════════════════════════════════════════════
//  DRAG — move zone freely
// ══════════════════════════════════════════════
const startDrag = (e: PointerEvent) => {
  if ((e.target as HTMLElement).dataset.handle) return
  e.preventDefault()
  deselectAll()
  const s = sc.value
  const sx = e.clientX, sy = e.clientY
  const ox = rectData.value.x, oy = rectData.value.y

  const onMove = (me: PointerEvent) => {
    rectData.value = { ...rectData.value,
      x: ox + (me.clientX - sx) / s,
      y: oy + (me.clientY - sy) / s
    }
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    saveBoundary(false)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

// ══════════════════════════════════════════════
//  RESIZE — locked 5:6 ratio, opposite corner anchored
// ══════════════════════════════════════════════
const CORNER: Record<string, [number, number]> = {
  tl: [0, 0], tr: [1, 0], bl: [0, 1], br: [1, 1]
}
const OPP: Record<string, string> = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' }

const startResize = (e: PointerEvent, corner: string) => {
  e.preventDefault(); e.stopPropagation()
  const s = sc.value
  const rect = canvasRef.value!.getBoundingClientRect()
  const rad = rectData.value.rotation * Math.PI / 180
  const cosR = Math.cos(rad), sinR = Math.sin(rad)
  const w = rectData.value.width * s, h = rectData.value.height * s
  const x = rectData.value.x * s,    y = rectData.value.y * s

  const ao = CORNER[OPP[corner]], ho = CORNER[corner]
  const ax = x + ao[0] * w * cosR - ao[1] * h * sinR
  const ay = y + ao[0] * w * sinR + ao[1] * h * cosR

  const ldx = (ho[0] - ao[0]) * w, ldy = (ho[1] - ao[1]) * h
  const wdx = ldx * cosR - ldy * sinR,  wdy = ldx * sinR + ldy * cosR
  const dLen = Math.sqrt(wdx * wdx + wdy * wdy)
  const nx = wdx / dLen, ny = wdy / dLen

  const minW = 40

  const onMove = (me: PointerEvent) => {
    const mx = me.clientX - rect.left, my = me.clientY - rect.top
    const proj = (mx - ax) * nx + (my - ay) * ny
    const sf = proj / dLen
    let nw = w * sf, nh = nw / ZONE_RATIO
    if (nw < minW * s) { nw = minW * s; nh = nw / ZONE_RATIO }

    const nx2 = ax - (ao[0] * nw * cosR - ao[1] * nh * sinR)
    const ny2 = ay - (ao[0] * nw * sinR + ao[1] * nh * cosR)

    rectData.value = { ...rectData.value,
      x: nx2 / s, y: ny2 / s, width: nw / s, height: nh / s
    }
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    saveBoundary(false)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

// ══════════════════════════════════════════════
//  ROTATE — visually pivots around zone center
// ══════════════════════════════════════════════
const startRotate = (e: PointerEvent) => {
  e.preventDefault(); e.stopPropagation()
  const s = sc.value
  const rect = canvasRef.value!.getBoundingClientRect()
  const rad = rectData.value.rotation * Math.PI / 180
  const w = rectData.value.width * s, h = rectData.value.height * s

  const cx = rectData.value.x * s + (w / 2) * Math.cos(rad) - (h / 2) * Math.sin(rad)
  const cy = rectData.value.y * s + (w / 2) * Math.sin(rad) + (h / 2) * Math.cos(rad)

  const pageCx = rect.left + cx, pageCy = rect.top + cy
  const initAngle = Math.atan2(e.clientY - pageCy, e.clientX - pageCx) * 180 / Math.PI
  const initRot = rectData.value.rotation

  const onMove = (me: PointerEvent) => {
    const angle = Math.atan2(me.clientY - pageCy, me.clientX - pageCx) * 180 / Math.PI
    let nr = initRot + (angle - initAngle)
    nr = ((nr % 360) + 360) % 360

    for (const snap of [0, 45, 90, 135, 180, 225, 270, 315]) {
      if (Math.abs(nr - snap) < 5) { nr = snap; break }
    }

    const nRad = nr * Math.PI / 180
    const tlx = cx - (w / 2) * Math.cos(nRad) + (h / 2) * Math.sin(nRad)
    const tly = cy - (w / 2) * Math.sin(nRad) - (h / 2) * Math.cos(nRad)

    rectData.value = { ...rectData.value,
      x: tlx / s, y: tly / s, rotation: nr
    }
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    saveBoundary(false)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

// ── Actions ──
const resetArea = () => { rectData.value = { ...DEFAULT_ZONE }; saveBoundary(false) }

const saveBoundary = (showAlert = true) => {
  if (store.selectedIndex !== -1) {
    store.setBoundary(store.selectedIndex, { ...rectData.value })
    if (showAlert) alert('Configuration saved!')
  }
}

// ── Clipboard & Undo ──
let clipboard: { type: 'text', data: TextOverlay } | { type: 'image', data: ImageOverlay } | null = null

type UndoEntry =
  | { action: 'deleteText', mockupId: string, data: TextOverlay }
  | { action: 'deleteImage', mockupId: string, data: ImageOverlay }
const undoStack: UndoEntry[] = []

const handleKeyboard = (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return

  // Delete with Backspace/Delete
  if (e.key === 'Backspace' || e.key === 'Delete') {
    const mockup = store.currentMockup
    if (!mockup) return
    if (store.selectedTextId) {
      const t = (store.textOverlays[mockup.id] || []).find(t => t.id === store.selectedTextId)
      if (t) undoStack.push({ action: 'deleteText', mockupId: mockup.id, data: { ...t } })
      e.preventDefault()
      store.deleteTextOverlay(store.selectedTextId)
    } else if (store.selectedImageId) {
      const img = (store.imageOverlays[mockup.id] || []).find(i => i.id === store.selectedImageId)
      if (img) undoStack.push({ action: 'deleteImage', mockupId: mockup.id, data: { ...img } })
      e.preventDefault()
      store.deleteImageOverlay(store.selectedImageId)
    }
    return
  }

  const mod = e.metaKey || e.ctrlKey
  if (!mod) return

  // Undo (Ctrl+Z)
  if (e.key === 'z') {
    e.preventDefault()
    const entry = undoStack.pop()
    if (!entry) return
    if (entry.action === 'deleteText') {
      if (!store.textOverlays[entry.mockupId]) store.textOverlays[entry.mockupId] = []
      store.textOverlays[entry.mockupId].push(entry.data)
      store.selectedTextId = entry.data.id
      store.selectedImageId = null
      store.saveTextsToStorage()
    } else if (entry.action === 'deleteImage') {
      if (!store.imageOverlays[entry.mockupId]) store.imageOverlays[entry.mockupId] = []
      store.imageOverlays[entry.mockupId].push(entry.data)
      store.selectedImageId = entry.data.id
      store.selectedTextId = null
      store.saveImagesToStorage()
    }
    return
  }

  // Copy (Ctrl+C)
  if (e.key === 'c') {
    if (selectedText.value) {
      clipboard = { type: 'text', data: { ...selectedText.value } }
    } else if (selectedImage.value) {
      clipboard = { type: 'image', data: { ...selectedImage.value } }
    }
  }
  // Paste (Ctrl+V)
  else if (e.key === 'v' && clipboard) {
    e.preventDefault()
    if (clipboard.type === 'text') {
      store.pasteTextOverlay(clipboard.data)
    } else {
      store.pasteImageOverlay(clipboard.data)
    }
  }
}

onMounted(() => {
  updateContainerSize()
  window.addEventListener('resize', updateContainerSize)
  window.addEventListener('keydown', handleKeyboard)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateContainerSize)
  window.removeEventListener('keydown', handleKeyboard)
})
</script>

<template>
  <div class="w-full h-full flex flex-col gap-3">
    <!-- Zone Toolbar -->
    <div class="flex items-center justify-between bg-slate-900/60 p-4 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-xl">
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-3">
          <Layout class="w-5 h-5 text-indigo-400" />
          <span class="text-xs font-black text-white uppercase">Design Editor Workspace</span>
        </div>
        <p class="text-[11px] text-slate-400">
          <span class="text-indigo-400 font-bold">Drag</span> to move &middot;
          <span class="text-indigo-400 font-bold">Corners</span> to scale (5:6 locked) &middot;
          <span class="text-indigo-400 font-bold">Top circle</span> to rotate
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button @click="resetArea" class="btn-secondary !px-6">
          <RotateCw class="w-3.5 h-3.5" /> Reset
        </button>
        <button @click="saveBoundary" class="btn-primary !px-8 !bg-indigo-600">
          <Save class="w-4 h-4" /> Save Area
        </button>
      </div>
    </div>

    <!-- Overlay Toolbar -->
    <div class="flex items-center gap-3 bg-slate-900/60 px-4 py-2.5 rounded-2xl border border-white/5 backdrop-blur-xl flex-wrap">
      <!-- Add buttons -->
      <button
        @click="store.addTextOverlay()"
        class="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg transition-colors"
      >
        <Type class="w-3.5 h-3.5" /> Add Text
      </button>
      <input ref="imageInputRef" type="file" accept="image/*" class="hidden" @change="handleImageUpload" />
      <button
        @click="imageInputRef?.click()"
        class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition-colors"
      >
        <ImagePlus class="w-3.5 h-3.5" /> Add Image
      </button>

      <!-- Text properties (when text selected) -->
      <template v-if="selectedText">
        <div class="w-px h-6 bg-white/10" />
        <input
          :value="selectedText.text"
          @input="updateSelected('text', ($event.target as HTMLInputElement).value)"
          class="bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white w-32 focus:outline-none focus:border-indigo-500/50"
        />
        <select
          :value="selectedText.fontFamily"
          @change="updateSelected('fontFamily', ($event.target as HTMLSelectElement).value)"
          class="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer max-w-[120px]"
        >
          <option v-for="f in FONTS" :key="f" :value="f" :style="{ fontFamily: f }" class="bg-slate-800">{{ f }}</option>
        </select>
        <input
          type="number" :value="selectedText.fontSize"
          @change="updateSelected('fontSize', +($event.target as HTMLInputElement).value)"
          class="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-16 focus:outline-none focus:border-indigo-500/50"
          min="10" max="500" step="5"
        />
        <button @click="updateSelected('bold', !selectedText.bold)"
          class="p-1.5 rounded-lg border transition-all"
          :class="selectedText.bold ? 'bg-indigo-600/20 border-indigo-500/30 text-white' : 'border-white/10 text-slate-500 hover:text-white'">
          <Bold class="w-4 h-4" />
        </button>
        <button @click="updateSelected('italic', !selectedText.italic)"
          class="p-1.5 rounded-lg border transition-all"
          :class="selectedText.italic ? 'bg-indigo-600/20 border-indigo-500/30 text-white' : 'border-white/10 text-slate-500 hover:text-white'">
          <Italic class="w-4 h-4" />
        </button>
        <label class="flex items-center gap-1 cursor-pointer">
          <span class="text-[9px] text-slate-500 uppercase font-bold">Color</span>
          <input type="color" :value="selectedText.color"
            @input="updateSelected('color', ($event.target as HTMLInputElement).value)"
            class="w-6 h-6 rounded cursor-pointer border border-white/10 bg-transparent" />
        </label>
        <label class="flex items-center gap-1 cursor-pointer">
          <span class="text-[9px] text-slate-500 uppercase font-bold">BG</span>
          <input type="color" :value="selectedText.highlight || '#000000'"
            @input="updateSelected('highlight', ($event.target as HTMLInputElement).value)"
            class="w-6 h-6 rounded cursor-pointer border border-white/10 bg-transparent" />
        </label>
        <button v-if="selectedText.highlight" @click="updateSelected('highlight', '')"
          class="text-[9px] text-slate-500 hover:text-white font-bold transition-colors">Clear</button>
        <button @click="store.deleteTextOverlay(store.selectedTextId!)"
          class="p-1.5 rounded-lg border border-white/10 text-red-400 hover:bg-red-500/10 transition-all ml-1">
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </template>

      <!-- Image properties (when image selected) -->
      <template v-if="selectedImage">
        <div class="w-px h-6 bg-white/10" />
        <span class="text-[10px] text-slate-400 font-bold uppercase">Image</span>
        <label class="flex items-center gap-1.5">
          <span class="text-[9px] text-slate-500 uppercase font-bold">W</span>
          <input type="number" :value="Math.round(selectedImage.width)"
            @change="store.updateImageOverlay(selectedImage!.id, { width: +($event.target as HTMLInputElement).value, height: +($event.target as HTMLInputElement).value * selectedImage!.height / selectedImage!.width })"
            class="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-16 focus:outline-none focus:border-indigo-500/50"
            min="20" step="10" />
        </label>
        <label class="flex items-center gap-1.5">
          <span class="text-[9px] text-slate-500 uppercase font-bold">H</span>
          <input type="number" :value="Math.round(selectedImage.height)"
            @change="store.updateImageOverlay(selectedImage!.id, { height: +($event.target as HTMLInputElement).value, width: +($event.target as HTMLInputElement).value * selectedImage!.width / selectedImage!.height })"
            class="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-16 focus:outline-none focus:border-indigo-500/50"
            min="20" step="10" />
        </label>
        <button @click="store.deleteImageOverlay(store.selectedImageId!)"
          class="p-1.5 rounded-lg border border-white/10 text-red-400 hover:bg-red-500/10 transition-all ml-1">
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </template>
    </div>

    <!-- Canvas -->
    <div ref="containerRef"
         class="flex-1 bg-slate-950 rounded-[40px] border border-white/5 overflow-hidden relative shadow-2xl"
         @pointerdown.self="deselectAll">

      <div v-if="mockupLoaded && store.currentMockup"
           ref="canvasRef" class="absolute" :style="canvasStyle"
           @pointerdown.self="deselectAll">

        <!-- Mockup image -->
        <img :src="store.currentMockup.src"
             class="absolute pointer-events-none select-none"
             :style="mockupImgStyle" draggable="false" />

        <!-- ── Design Zone ── -->
        <div class="absolute cursor-move select-none"
             :style="zoneStyle"
             @pointerdown="startDrag">

          <div class="w-full h-full border-2 border-indigo-400/70 bg-indigo-500/5 overflow-hidden">
            <img v-if="store.designSrc" :src="store.designSrc"
                 class="w-full h-full object-fill opacity-85 pointer-events-none select-none"
                 draggable="false" />
          </div>

          <!-- Corner handles -->
          <div v-for="c in ['tl','tr','bl','br']" :key="c"
               :data-handle="c"
               class="absolute w-[14px] h-[14px] bg-white border-2 border-indigo-500 rounded-[3px] z-10
                      hover:scale-125 active:scale-110 transition-transform"
               :class="{
                 '-top-[7px] -left-[7px] cursor-nwse-resize':  c === 'tl',
                 '-top-[7px] -right-[7px] cursor-nesw-resize': c === 'tr',
                 '-bottom-[7px] -left-[7px] cursor-nesw-resize': c === 'bl',
                 '-bottom-[7px] -right-[7px] cursor-nwse-resize': c === 'br'
               }"
               @pointerdown="startResize($event, c)" />

          <!-- Rotate connector + handle -->
          <div class="absolute top-[-30px] left-1/2 -translate-x-[1px] w-[2px] h-[30px] bg-indigo-400/40 pointer-events-none" />
          <div data-handle="rotate"
               class="absolute top-[-44px] left-1/2 -translate-x-1/2
                      w-[16px] h-[16px] bg-white border-2 border-indigo-500 rounded-full z-10
                      cursor-grab hover:scale-125 active:scale-110 transition-transform
                      flex items-center justify-center"
               @pointerdown="startRotate">
            <RotateCw class="w-[8px] h-[8px] text-indigo-500 pointer-events-none" />
          </div>
        </div>

        <!-- ── Text Overlays ── -->
        <div
          v-for="t in currentTexts"
          :key="t.id"
          class="absolute select-none z-20"
          :class="editingTextId === t.id ? 'cursor-text' : 'cursor-move'"
          :style="getTextStyle(t)"
          @pointerdown.stop="startTextDrag($event, t)"
          @dblclick.stop="startTextEdit(t)"
        >
          <input
            v-if="editingTextId === t.id"
            ref="textEditRef"
            :value="t.text"
            @blur="finishTextEdit(t, $event)"
            @keydown.enter="finishTextEdit(t, $event)"
            class="bg-transparent outline-none border-none text-inherit w-full"
            :style="{ fontFamily: 'inherit', fontWeight: 'inherit', fontStyle: 'inherit', fontSize: 'inherit', color: 'inherit' }"
          />
          <span v-else class="pointer-events-none">{{ t.text }}</span>
        </div>

        <!-- ── Image Overlays ── -->
        <div
          v-for="img in currentImages"
          :key="img.id"
          class="absolute select-none z-20 cursor-move"
          :style="getImageStyle(img)"
          @pointerdown.stop="startImageDrag($event, img)"
        >
          <img :src="img.src" class="w-full h-full object-contain pointer-events-none" draggable="false" />
          <!-- Resize handles (visible when selected) -->
          <template v-if="store.selectedImageId === img.id">
            <div v-for="c in ['tl','tr','bl','br']" :key="c"
                 data-imghandle="true"
                 class="absolute w-[12px] h-[12px] bg-white border-2 border-emerald-500 rounded-[3px] z-10
                        hover:scale-125 active:scale-110 transition-transform"
                 :class="{
                   '-top-[6px] -left-[6px] cursor-nwse-resize': c === 'tl',
                   '-top-[6px] -right-[6px] cursor-nesw-resize': c === 'tr',
                   '-bottom-[6px] -left-[6px] cursor-nesw-resize': c === 'bl',
                   '-bottom-[6px] -right-[6px] cursor-nwse-resize': c === 'br'
                 }"
                 @pointerdown.stop="startImageResize($event, img, c)" />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
