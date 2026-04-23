import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      minify: true
    },
    esbuild: {
      treeShaking: true
    }
  },
  preload: {
    build: {
      minify: true
    },
    esbuild: {
      treeShaking: true
    }
  },
  renderer: {
    build: {
      minify: 'esbuild'
    },
    esbuild: {
      treeShaking: true
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
