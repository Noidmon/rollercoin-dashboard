import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { PlayerProvider } from './context/PlayerContext'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Calculadora from './pages/Calculadora'
import Merges from './pages/Merges'
import Hamsters from './pages/Hamsters'
import Eventos from './pages/Eventos'
import Simulador from './pages/Simulador'

function App() {
  return (
    <PlayerProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calculadora" element={<Calculadora />} />
          <Route path="/merges" element={<Merges />} />
          <Route path="/hamsters" element={<Hamsters />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/simulador" element={<Simulador />} />
        </Routes>
      </Layout>
    </PlayerProvider>
  )
}

export default App
