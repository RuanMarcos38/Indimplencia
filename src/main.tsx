import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AuthDialog from './AuthDialog';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <AuthDialog />
  </StrictMode>
);


