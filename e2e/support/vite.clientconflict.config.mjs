import { defineConfig } from 'vite'
import path from 'node:path'
const here = path.dirname(new URL(import.meta.url).pathname)
export default defineConfig({
  resolve: {
    alias: [
      { find: /^.*\/lib\/supabase\/client$/, replacement: path.join(here, 'pgrstClient.ts') },
      { find: /^.*\/data\/dataMode$/, replacement: path.join(here, 'cloudMode.ts') },
    ],
  },
  build: {
    outDir: path.join(here, '../../.clientconflict-out'),
    emptyOutDir: true,
    lib: { entry: path.join(here, 'clientConflict.entry.ts'), formats: ['es'], fileName: () => 'clientconflict.mjs' },
    minify: false,
    target: 'node20',
  },
})
