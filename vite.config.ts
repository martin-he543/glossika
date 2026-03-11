import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'glossika'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? `/${repositoryName}/` : '/',
}))

