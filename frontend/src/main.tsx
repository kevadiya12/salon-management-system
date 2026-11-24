import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { salonConfig, salonThemeCssVariables } from './config/salon';
import { AuthProvider } from './contexts/AuthContext';
import './styles.css';

for (const [property, value] of Object.entries(salonThemeCssVariables)) {
  document.documentElement.style.setProperty(property, value);
}
document.title = `${salonConfig.name} Queue Management`;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
