import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { PlayerProvider } from './context/PlayerContext'
import { NetworkDataProvider } from './context/NetworkDataContext'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Calculadora from './pages/Calculadora'
import Merges from './pages/Merges'
import Mineradores from './pages/Mineradores'
import MineradorDetalhe from './pages/MineradorDetalhe'
import Hamsters from './pages/Hamsters'
import Eventos from './pages/Eventos'
import Simulador from './pages/Simulador'
import Admin from './pages/Admin'

function App() {
  return (
    <PlayerProvider>
      <NetworkDataProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/calculadora" element={<Calculadora />} />
            <Route path="/merges" element={<Merges />} />
            <Route path="/mineradores" element={<Mineradores />} />
            <Route path="/mineradores/:slug" element={<MineradorDetalhe />} />
            <Route path="/hamsters" element={<Hamsters />} />
            <Route path="/eventos" element={<Eventos />} />
            <Route path="/simulador" element={<Simulador />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Layout>
      </NetworkDataProvider>
    </PlayerProvider>
  )
}

export default App
