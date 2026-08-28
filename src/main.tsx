import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* basename=BASE_URL -- sem isso, sob o base path do GitHub Pages
        (ex: /rollercoin-dashboard/), o React Router trataria toda rota
        como se o app estivesse na raiz do domínio: <Link to="/mineradores">
        navegaria pra .github.io/mineradores (404) em vez de
        .github.io/rollercoin-dashboard/mineradores. */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
