import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import AdminApp from './AdminApp';

const searchParams = new URLSearchParams(window.location.search);
const isAdminView = window.location.pathname.startsWith('/admin') || searchParams.has('admin');
const RootComponent = isAdminView ? AdminApp : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>,
);
