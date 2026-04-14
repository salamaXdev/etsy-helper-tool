import { defineStore } from 'pinia'

interface Boundary {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

interface Mockup {
  id: string
  name: string
  src: string
  boundary: Boundary | null
}

export const useMockupStore = defineStore('mockup', {
  state: () => ({
    mockups: [] as Mockup[],
    designSrc: null as string | null,
    selectedIndex: 0,
    isProcessing: false,
    activeListing: null as { id: string, version: string } | null,
    // Export selection: id → false means explicitly excluded. Absent or true = included.
    exportSelection: {} as Record<string, boolean>,
    // Per-mockup multiply blend: id → true means enabled. Default off.
    multiplyBlend: {} as Record<string, boolean>
  }),

  getters: {
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
      const boundaryMap: Record<string, Boundary> = {}
      this.mockups.forEach(m => {
        if (m.boundary) {
          boundaryMap[m.name] = m.boundary
        }
      })
      localStorage.setItem('etsy_helper_boundaries', JSON.stringify(boundaryMap))
    },
    
    setDesign(src: string) {
      this.designSrc = src
    },

    async init() {
      let savedBoundaries: Record<string, Boundary> = {}
      try {
        const saved = localStorage.getItem('etsy_helper_boundaries')
        if (saved) {
          savedBoundaries = JSON.parse(saved)
        }
      } catch (e) {
        console.warn('Could not parse saved boundaries')
      }

      try {
        const response = await fetch('/src/assets/default-mockups.json')
        if (response.ok) {
          const defaults = await response.json()
          defaults.forEach((m: { name: string, url: string }) => {
            // Only add if not already there
            if (!this.mockups.find(existing => existing.src === m.url)) {
              this.addMockup(m.url, m.name)
              const addedMockup = this.mockups[this.mockups.length - 1]
              if (savedBoundaries[m.name]) {
                 addedMockup.boundary = savedBoundaries[m.name]
              }
            }
          })
        }
      } catch (e) {
        console.warn('No default mockups found.')
      }
    },
    
    deleteMockup(index: number) {
      this.mockups.splice(index, 1)
      if (this.selectedIndex >= this.mockups.length) {
        this.selectedIndex = Math.max(0, this.mockups.length - 1)
      }
    }
  }
})
