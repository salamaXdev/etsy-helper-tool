import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'

const ETSY_BASE_PATH = '/Users/anassalama/Documents/POD & Design/Etsy/Work 2026/Meryem Work/etsy'

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
      name: 'save-listing-api',
      configureServer(server) {
        server.middlewares.use('/api/save-listing', async (req, res, next) => {
          if (req.method === 'POST') {
            try {
              const { version, id, images } = await getBody(req)
              const targetDir = path.join(ETSY_BASE_PATH, version, 'listing')
              
              if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true })
              }

              images.forEach((img: any, index: number) => {
                  const base64Data = img.data.replace(/^data:image\/\w+;base64,/, "")
                  const buffer = Buffer.from(base64Data, 'base64')
                  const fileName = `Artboard_${index + 1}_${id}.png`
                  fs.writeFileSync(path.join(targetDir, fileName), buffer)
              })

              res.end(JSON.stringify({ success: true, count: images.length }))
            } catch (e) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Failed to save' }))
            }
          } else {
            next()
          }
        })
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      allow: ['..', ETSY_BASE_PATH]
    }
  }
})
