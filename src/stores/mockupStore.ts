import { defineStore } from 'pinia'

interface Boundary {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface MockupEvent {
  id: string
  name: string
  folder?: string // set for events auto-seeded from public/mockups/
}

export interface TextOverlay {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  fontFamily: string
  bold: boolean
  italic: boolean
  color: string
  highlight: string
}

export interface ImageOverlay {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
}

interface Mockup {
  id: string
  name: string
  src: string
  boundary: Boundary | null
}

export const useMockupStore = defineStore('mockup', {
  state: () => ({
    events: [] as MockupEvent[],
    activeEventId: null as string | null,
    mockups: [] as Mockup[],
    designSrc: null as string | null,
    selectedIndex: 0,
    isProcessing: false,
    activeListing: null as { id: string, version: string } | null,
    exportSelection: {} as Record<string, boolean>,
    multiplyBlend: {} as Record<string, boolean>,
    textOverlays: {} as Record<string, TextOverlay[]>,
    imageOverlays: {} as Record<string, ImageOverlay[]>,
    selectedTextId: null as string | null,
    selectedImageId: null as string | null
  }),

  getters: {
    activeEvent: (state) => state.events.find(e => e.id === state.activeEventId) || null,
    currentMockup: (state) => state.mockups[state.selectedIndex] || null,
    exportMockups: (state) => state.mockups.filter(
      m => m.boundary && state.exportSelection[m.id] !== false
    ),
    exportSelectedCount: (state) => state.mockups.filter(
      m => m.boundary && state.exportSelection[m.id] !== false
    ).length,
    configuredCount: (state) => state.mockups.filter(m => m.boundary).length,
  },

  actions: {
    // ── Event Management ──
    createEvent(name: string, folder?: string) {
      const id = crypto.randomUUID()
      const event: MockupEvent = { id, name }
      if (folder) event.folder = folder
      this.events.push(event)
      this.saveEventsToStorage()
      return id
    },

    deleteEvent(id: string) {
      this.events = this.events.filter(e => e.id !== id)
      if (this.activeEventId === id) {
        this.activeEventId = null
        this.mockups = []
        this.selectedIndex = 0
      }
      localStorage.removeItem(`etsy_helper_boundaries_${id}`)
      localStorage.removeItem(`etsy_helper_mockups_${id}`)
      localStorage.removeItem(`etsy_helper_texts_${id}`)
      localStorage.removeItem(`etsy_helper_images_${id}`)
      this.saveEventsToStorage()
    },

    async selectEvent(id: string) {
      // Save current event data before switching
      this.saveBoundariesToStorage()
      this.saveMockupsToStorage()
      this.saveTextsToStorage()
      this.saveImagesToStorage()

      this.activeEventId = id
      this.mockups = []
      this.selectedIndex = 0
      this.exportSelection = {}
      this.multiplyBlend = {}
      this.textOverlays = {}
      this.imageOverlays = {}
      this.selectedTextId = null
      this.selectedImageId = null

      // Load text and image overlays for this event
      try {
        const savedTexts = localStorage.getItem(`etsy_helper_texts_${id}`)
        if (savedTexts) this.textOverlays = JSON.parse(savedTexts)
      } catch {}
      try {
        const savedImages = localStorage.getItem(`etsy_helper_images_${id}`)
        if (savedImages) this.imageOverlays = JSON.parse(savedImages)
      } catch {}

      const event = this.events.find(e => e.id === id)
      if (!event) return

      let savedBoundaries: Record<string, Boundary> = {}
      try {
        const saved = localStorage.getItem(`etsy_helper_boundaries_${id}`)
        if (saved) savedBoundaries = JSON.parse(saved)
      } catch {}

      // If event has a folder, load mockups from the server API
      if (event.folder) {
        try {
          const response = await fetch('/api/scan-mockups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder: event.folder })
          })
          if (response.ok) {
            const files: { name: string, url: string }[] = await response.json()
            files.forEach(f => {
              this.addMockup(f.url, f.name)
              const added = this.mockups[this.mockups.length - 1]
              if (savedBoundaries[f.name]) {
                added.boundary = savedBoundaries[f.name]
              }
            })
          }
        } catch (e) {
          console.warn('Failed to load mockups from folder:', e)
        }
      } else {
        // User-created event: restore mockups from localStorage
        try {
          const saved = localStorage.getItem(`etsy_helper_mockups_${id}`)
          if (saved) {
            const mockupList: { name: string, src: string }[] = JSON.parse(saved)
            mockupList.forEach(m => {
              this.addMockup(m.src, m.name)
              const added = this.mockups[this.mockups.length - 1]
              if (savedBoundaries[m.name]) {
                added.boundary = savedBoundaries[m.name]
              }
            })
          }
        } catch {}
      }

      this.saveEventsToStorage()
    },

    saveEventsToStorage() {
      localStorage.setItem('etsy_helper_events', JSON.stringify(this.events))
      if (this.activeEventId) {
        localStorage.setItem('etsy_helper_active_event', this.activeEventId)
      }
    },

    saveMockupsToStorage() {
      if (!this.activeEventId) return
      const event = this.events.find(e => e.id === this.activeEventId)
      if (event?.folder) return // folder-based events don't need localStorage mockups
      const mockupList = this.mockups.map(m => ({ name: m.name, src: m.src }))
      localStorage.setItem(`etsy_helper_mockups_${this.activeEventId}`, JSON.stringify(mockupList))
    },

    // ── Mockup Management ──
    addMockup(src: string, name: string) {
      const id = crypto.randomUUID()
      this.mockups.push({ id, name, src, boundary: null })
      this.exportSelection[id] = true
    },

    toggleExport(id: string) {
      this.exportSelection[id] = this.exportSelection[id] === false ? true : false
    },

    selectAllExport() {
      this.mockups.forEach(m => { this.exportSelection[m.id] = true })
    },

    deselectAllExport() {
      this.mockups.forEach(m => { this.exportSelection[m.id] = false })
    },

    toggleMultiply(id: string) {
      this.multiplyBlend[id] = !this.multiplyBlend[id]
    },

    setBoundary(index: number, boundary: Boundary) {
      if (this.mockups[index]) {
        this.mockups[index].boundary = boundary
        this.saveBoundariesToStorage()
      }
    },

    saveBoundariesToStorage() {
      if (!this.activeEventId) return
      const boundaryMap: Record<string, Boundary> = {}
      this.mockups.forEach(m => {
        if (m.boundary) {
          boundaryMap[m.name] = m.boundary
        }
      })
      localStorage.setItem(`etsy_helper_boundaries_${this.activeEventId}`, JSON.stringify(boundaryMap))
    },

    // ── Text Overlays ──
    addTextOverlay() {
      const mockup = this.currentMockup
      if (!mockup) return
      const id = crypto.randomUUID()
      const overlay: TextOverlay = {
        id, text: 'New Text', x: 800, y: 900,
        fontSize: 80, fontFamily: 'Outfit',
        bold: false, italic: false,
        color: '#ffffff', highlight: ''
      }
      if (!this.textOverlays[mockup.id]) this.textOverlays[mockup.id] = []
      this.textOverlays[mockup.id].push(overlay)
      this.selectedTextId = id
      this.saveTextsToStorage()
    },

    updateTextOverlay(textId: string, updates: Partial<TextOverlay>) {
      const mockup = this.currentMockup
      if (!mockup) return
      const texts = this.textOverlays[mockup.id]
      if (!texts) return
      const t = texts.find(t => t.id === textId)
      if (t) {
        Object.assign(t, updates)
        this.saveTextsToStorage()
      }
    },

    deleteTextOverlay(textId: string) {
      const mockup = this.currentMockup
      if (!mockup) return
      const texts = this.textOverlays[mockup.id]
      if (!texts) return
      this.textOverlays[mockup.id] = texts.filter(t => t.id !== textId)
      if (this.selectedTextId === textId) this.selectedTextId = null
      this.saveTextsToStorage()
    },

    pasteTextOverlay(source: TextOverlay) {
      const mockup = this.currentMockup
      if (!mockup) return
      const id = crypto.randomUUID()
      const copy: TextOverlay = { ...source, id, x: source.x + 30, y: source.y + 30 }
      if (!this.textOverlays[mockup.id]) this.textOverlays[mockup.id] = []
      this.textOverlays[mockup.id].push(copy)
      this.selectedTextId = id
      this.selectedImageId = null
      this.saveTextsToStorage()
    },

    saveTextsToStorage() {
      if (!this.activeEventId) return
      localStorage.setItem(`etsy_helper_texts_${this.activeEventId}`, JSON.stringify(this.textOverlays))
    },

    // ── Image Overlays ──
    addImageOverlay(src: string, naturalW: number, naturalH: number) {
      const mockup = this.currentMockup
      if (!mockup) return
      const id = crypto.randomUUID()
      // Fit to ~400 internal units wide, keep aspect ratio
      const w = 400
      const h = w * (naturalH / naturalW)
      const overlay: ImageOverlay = { id, src, x: 750, y: 800, width: w, height: h }
      if (!this.imageOverlays[mockup.id]) this.imageOverlays[mockup.id] = []
      this.imageOverlays[mockup.id].push(overlay)
      this.selectedImageId = id
      this.selectedTextId = null
      this.saveImagesToStorage()
    },

    updateImageOverlay(imgId: string, updates: Partial<ImageOverlay>) {
      const mockup = this.currentMockup
      if (!mockup) return
      const imgs = this.imageOverlays[mockup.id]
      if (!imgs) return
      const img = imgs.find(i => i.id === imgId)
      if (img) {
        Object.assign(img, updates)
        this.saveImagesToStorage()
      }
    },

    deleteImageOverlay(imgId: string) {
      const mockup = this.currentMockup
      if (!mockup) return
      const imgs = this.imageOverlays[mockup.id]
      if (!imgs) return
      this.imageOverlays[mockup.id] = imgs.filter(i => i.id !== imgId)
      if (this.selectedImageId === imgId) this.selectedImageId = null
      this.saveImagesToStorage()
    },

    pasteImageOverlay(source: ImageOverlay) {
      const mockup = this.currentMockup
      if (!mockup) return
      const id = crypto.randomUUID()
      const copy: ImageOverlay = { ...source, id, x: source.x + 30, y: source.y + 30 }
      if (!this.imageOverlays[mockup.id]) this.imageOverlays[mockup.id] = []
      this.imageOverlays[mockup.id].push(copy)
      this.selectedImageId = id
      this.selectedTextId = null
      this.saveImagesToStorage()
    },

    saveImagesToStorage() {
      if (!this.activeEventId) return
      localStorage.setItem(`etsy_helper_images_${this.activeEventId}`, JSON.stringify(this.imageOverlays))
    },

    setDesign(src: string) {
      this.designSrc = src
    },

    async init() {
      // Load events from storage
      try {
        const saved = localStorage.getItem('etsy_helper_events')
        if (saved) this.events = JSON.parse(saved)
      } catch {}

      // Fetch available folders from public/mockups/
      let availableFolders: string[] = []
      try {
        const response = await fetch('/api/list-mockup-folders')
        if (response.ok) availableFolders = await response.json()
      } catch {}

      if (this.events.length === 0) {
        // Seed events from folders
        for (const folder of availableFolders) {
          this.createEvent(folder, folder)
        }
      } else {
        // Migrate: if an event name matches a folder but has no folder field, set it
        let changed = false
        for (const event of this.events) {
          if (!event.folder && availableFolders.includes(event.name)) {
            event.folder = event.name
            changed = true
          }
        }
        if (changed) this.saveEventsToStorage()
      }

      // Restore active event
      const savedActiveId = localStorage.getItem('etsy_helper_active_event')
      if (savedActiveId && this.events.find(e => e.id === savedActiveId)) {
        await this.selectEvent(savedActiveId)
      } else if (this.events.length > 0) {
        await this.selectEvent(this.events[0].id)
      }
    },

    deleteMockup(index: number) {
      this.mockups.splice(index, 1)
      if (this.selectedIndex >= this.mockups.length) {
        this.selectedIndex = Math.max(0, this.mockups.length - 1)
      }
      this.saveMockupsToStorage()
    }
  }
})
