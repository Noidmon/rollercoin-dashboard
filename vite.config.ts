import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serve o site em https://<usuario>.github.io/<repo>/, não na
// raiz do domínio -- `base` precisa bater com o nome EXATO do repositório
// (github.com/Noidmon/rollercoin-dashboard). Isso só resolve os caminhos que
// o próprio Vite processa (imports, tags do index.html) -- caminhos
// absoluto-raiz usados em runtime (fetch de public/data/*.json, <img src>
// de ícones estáticos) precisam passar por withBase() explicitamente (ver
// src/utils/withBase.ts) pra não quebrar sob esse prefixo.
//
// https://vite.dev/config/
export default defineConfig({
  base: '/rollercoin-dashboard/',
  plugins: [react(), tailwindcss()],
})
