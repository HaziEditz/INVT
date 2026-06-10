import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { LoginPage } from '@/pages/Login';
import { DispatchPage } from '@/pages/Dispatch';

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary label="Dispatch">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dispatch"
            element={
              <ErrorBoundary label="Dispatch console">
                <DispatchPage />
              </ErrorBoundary>
            }
          />
          <Route path="/" element={<Navigate to="/dispatch" replace />} />
          <Route path="*" element={<Navigate to="/dispatch" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
