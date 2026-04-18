import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'

const CONFIG_FILE = path.resolve(__dirname, 'etsy-config.json')

function readConfig(): { etsyPath: string } {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
  } catch {}
  return { etsyPath: '' }
}

function writeConfig(config: { etsyPath: string }) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

async function getBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: any) => body += chunk)
    req.on('end', () => resolve(JSON.parse(body)))
  })
}

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'etsy-helper-api',
      configureServer(server) {

        // ── Etsy config (GET / POST) ──
        server.middlewares.use('/api/etsy-config', async (req, res, next) => {
          res.setHeader('Content-Type', 'application/json')
          if (req.method === 'GET') {
            res.end(JSON.stringify(readConfig()))
          } else if (req.method === 'POST') {
            try {
              const { etsyPath } = await getBody(req)
              if (!fs.existsSync(etsyPath)) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Path does not exist' }))
                return
              }
              writeConfig({ etsyPath })
              res.end(JSON.stringify({ success: true }))
            } catch {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Failed to save config' }))
            }
          } else { next() }
        })

        // ── Scan Etsy designs folder ──
        server.middlewares.use('/api/scan-etsy', (req, res, next) => {
          if (req.method !== 'GET') { next(); return }
          res.setHeader('Content-Type', 'application/json')
          const { etsyPath } = readConfig()
          if (!etsyPath || !fs.existsSync(etsyPath)) {
            res.end(JSON.stringify([]))
            return
          }
          try {
            const designs: any[] = []
            const entries = fs.readdirSync(etsyPath, { withFileTypes: true })
              .filter(e => e.isDirectory())
              .sort((a, b) => a.name.localeCompare(b.name))

            for (const dir of entries) {
              const dirPath = path.join(etsyPath, dir.name)
              const files = fs.readdirSync(dirPath, { withFileTypes: true })
              for (const file of files) {
                if (!file.isFile() || !/\.png$/i.test(file.name)) continue
                const baseName = file.name.replace(/\.png$/i, '')
                if (!/^\d+$/.test(baseName)) continue

                const listingPath = path.join(dirPath, 'listing')
                let mockups: string[] = []
                if (fs.existsSync(listingPath)) {
                  mockups = fs.readdirSync(listingPath)
                    .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
                    .map(f => `/etsy-files/${dir.name}/listing/${f}`)
                }
                designs.push({
                  id: baseName,
                  version: dir.name,
                  designPath: `/etsy-files/${dir.name}/${file.name}`,
                  mockups,
                  etsyLink: `https://www.etsy.com/listing/${baseName}`
                })
              }
            }
            res.end(JSON.stringify(designs))
          } catch {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Scan failed' }))
          }
        })

        // ── Serve files from configured Etsy path ──
        server.middlewares.use('/etsy-files', (req, res, next) => {
          const { etsyPath } = readConfig()
          if (!etsyPath) { res.statusCode = 404; res.end(); return }

          const relPath = decodeURIComponent(req.url || '').replace(/^\//, '')
          const filePath = path.join(etsyPath, relPath)

          // Security: ensure resolved path is under etsyPath
          if (!filePath.startsWith(etsyPath)) { res.statusCode = 403; res.end(); return }
          if (!fs.existsSync(filePath)) { res.statusCode = 404; res.end(); return }

          const ext = path.extname(filePath).toLowerCase()
          const mime: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
          res.setHeader('Content-Type', mime[ext] || 'application/octet-stream')
          fs.createReadStream(filePath).pipe(res)
        })

        // ── Scan mockup subfolder for images ──
        server.middlewares.use('/api/scan-mockups', async (req, res, next) => {
          if (req.method === 'POST') {
            try {
              const { folder } = await getBody(req)
              const mockupsBase = path.resolve(__dirname, 'public', 'mockups')
              const targetDir = path.join(mockupsBase, folder)
              if (!targetDir.startsWith(mockupsBase)) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Invalid path' })); return }
              if (!fs.existsSync(targetDir)) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Folder not found' })); return }

              const files = fs.readdirSync(targetDir)
                .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
                .sort()
                .map(f => ({ name: f.replace(/\.[^.]+$/, ''), url: `/mockups/${folder}/${f}` }))

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(files))
            } catch { res.statusCode = 500; res.end(JSON.stringify({ error: 'Failed to scan' })) }
          } else { next() }
        })

        // ── List available mockup subfolders ──
        server.middlewares.use('/api/list-mockup-folders', (req, res, next) => {
          if (req.method === 'GET') {
            try {
              const mockupsBase = path.resolve(__dirname, 'public', 'mockups')
              const entries = fs.readdirSync(mockupsBase, { withFileTypes: true })
                .filter(e => e.isDirectory()).map(e => e.name).sort()
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(entries))
            } catch { res.statusCode = 500; res.end(JSON.stringify({ error: 'Failed to list folders' })) }
          } else { next() }
        })

        // ── Export mockups to user-chosen folder ──
        server.middlewares.use('/api/export-mockups', async (req, res, next) => {
          if (req.method === 'POST') {
            try {
              const { savePath: targetDir, images } = await getBody(req)
              if (!targetDir || typeof targetDir !== 'string') {
                res.statusCode = 400; res.end(JSON.stringify({ error: 'No save path provided' })); return
              }
              if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true })
              }

              images.forEach((img: any) => {
                const base64Data = img.data.replace(/^data:image\/\w+;base64,/, '')
                const buffer = Buffer.from(base64Data, 'base64')
                const fileName = img.name.replace(/[\/\\:*?"<>|]/g, '_') + '.jpg'
                fs.writeFileSync(path.join(targetDir, fileName), buffer)
              })
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, count: images.length }))
            } catch (e: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: e.message || 'Failed to save' }))
            }
          } else { next() }
        })
      }
    }
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    fs: { allow: ['..'] }
  }
})
