import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import AdminApp from './AdminApp';

const searchParams = new URLSearchParams(window.location.search);
const isAdminView = window.location.pathname.startsWith('/admin') || searchParams.has('admin');
const rootElement = document.getElementById('root')!;

if (isAdminView) {
  createRoot(rootElement).render(
    <StrictMode>
      <AdminApp onBackToUser={() => { window.location.href = '/'; }} />
    </StrictMode>,
  );
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
