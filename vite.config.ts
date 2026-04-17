import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const pagesBasePath = repositoryName ? `/${repositoryName}/` : '/'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Keep relative assets for Electron builds, but use repo-scoped base on GitHub Pages.
  base: isGitHubActions ? pagesBasePath : '/',
})
