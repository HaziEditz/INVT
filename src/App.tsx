import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/Login';
import { DispatchPage } from '@/pages/Dispatch';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dispatch" element={<DispatchPage />} />
        <Route path="/" element={<Navigate to="/dispatch" replace />} />
        <Route path="*" element={<Navigate to="/dispatch" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
