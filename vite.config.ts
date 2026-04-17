import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const explicitBasePath = process.env.VITE_BASE_PATH
const pagesBasePath = repositoryName ? `/${repositoryName}/` : '/'
const resolvedBasePath = explicitBasePath ?? (isGitHubActions ? pagesBasePath : '/')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Support explicit override for custom domains; fallback to repo path on project pages.
  base: resolvedBasePath,
})
