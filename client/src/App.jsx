import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Player from './pages/Player';
import Duplicates from './pages/Duplicates';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/player/:id" element={<Player />} />
        <Route path="/duplicates" element={<Duplicates />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App