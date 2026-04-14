<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useMockupStore } from '../stores/mockupStore'
import { Save, Layout, RotateCw } from 'lucide-vue-next'

const store = useMockupStore()
const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLDivElement | null>(null)

const INTERNAL_SIZE = 2000
const ZONE_RATIO = 5 / 6 // 4500:5400

const DEFAULT_ZONE = { x: 700, y: 540, width: 600, height: 720, rotation: 0 }
const rectData = ref({ ...DEFAULT_ZONE })

const containerSize = ref({ width: 800, height: 600 })
const mockupInfo = ref({ x: 0, y: 0, width: 2000, height: 2000 })
const mockupLoaded = ref(false)

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

// Zone uses transform-origin: 0 0  →  rotation pivot = top-left = (x, y)
// This matches Canvas2D in BatchPreview: ctx.translate(x,y) → ctx.rotate(r)
const zoneStyle = computed(() => {
  const s = sc.value, r = rectData.value
  return {
    left: `${r.x * s}px`, top: `${r.y * s}px`,
    width: `${r.width * s}px`, height: `${r.height * s}px`,
    transform: `rotate(${r.rotation}deg)`,
    transformOrigin: '0 0'
  }
})

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

  // Anchor = opposite corner, stays fixed
  const ao = CORNER[OPP[corner]], ho = CORNER[corner]
  const ax = x + ao[0] * w * cosR - ao[1] * h * sinR
  const ay = y + ao[0] * w * sinR + ao[1] * h * cosR

  // Diagonal direction anchor → handle (in world/screen coords)
  const ldx = (ho[0] - ao[0]) * w, ldy = (ho[1] - ao[1]) * h
  const wdx = ldx * cosR - ldy * sinR,  wdy = ldx * sinR + ldy * cosR
  const dLen = Math.sqrt(wdx * wdx + wdy * wdy)
  const nx = wdx / dLen, ny = wdy / dLen

  const minW = 40 // internal min

  const onMove = (me: PointerEvent) => {
    const mx = me.clientX - rect.left, my = me.clientY - rect.top
    const proj = (mx - ax) * nx + (my - ay) * ny
    const sf = proj / dLen
    let nw = w * sf, nh = nw / ZONE_RATIO
    if (nw < minW * s) { nw = minW * s; nh = nw / ZONE_RATIO }

    // Recompute TL so anchor corner stays put
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

  // Center of zone in canvas coords (fixed throughout this drag)
  const cx = rectData.value.x * s + (w / 2) * Math.cos(rad) - (h / 2) * Math.sin(rad)
  const cy = rectData.value.y * s + (w / 2) * Math.sin(rad) + (h / 2) * Math.cos(rad)

  const pageCx = rect.left + cx, pageCy = rect.top + cy
  const initAngle = Math.atan2(e.clientY - pageCy, e.clientX - pageCx) * 180 / Math.PI
  const initRot = rectData.value.rotation

  const onMove = (me: PointerEvent) => {
    const angle = Math.atan2(me.clientY - pageCy, me.clientX - pageCx) * 180 / Math.PI
    let nr = initRot + (angle - initAngle)
    nr = ((nr % 360) + 360) % 360

    // Snap to 45° steps (5° tolerance)
    for (const snap of [0, 45, 90, 135, 180, 225, 270, 315]) {
      if (Math.abs(nr - snap) < 5) { nr = snap; break }
    }

    // Adjust TL so the center stays fixed
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

onMounted(() => { updateContainerSize(); window.addEventListener('resize', updateContainerSize) })
onBeforeUnmount(() => { window.removeEventListener('resize', updateContainerSize) })
</script>

<template>
  <div class="w-full h-full flex flex-col gap-4">
    <!-- Toolbar -->
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

    <!-- Canvas -->
    <div ref="containerRef"
         class="flex-1 bg-slate-950 rounded-[40px] border border-white/5 overflow-hidden relative shadow-2xl">

      <div v-if="mockupLoaded && store.currentMockup"
           ref="canvasRef" class="absolute" :style="canvasStyle">

        <!-- Mockup image -->
        <img :src="store.currentMockup.src"
             class="absolute pointer-events-none select-none"
             :style="mockupImgStyle" draggable="false" />

        <!-- ── Design Zone ── -->
        <div class="absolute cursor-move select-none"
             :style="zoneStyle"
             @pointerdown="startDrag">

          <!-- Fill + border -->
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
      </div>
    </div>
  </div>
</template>
