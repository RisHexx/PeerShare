import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Import page components
import Home from './pages/Home';
import Send from './pages/Send';
import Receive from './pages/Receive';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/send" element={<Send />} />
        <Route path="/receive" element={<Receive />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
