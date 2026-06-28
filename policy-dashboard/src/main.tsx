import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClaimsDashboard } from './components/ClaimsDashboard';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ClaimsDashboard />
  </React.StrictMode>
);
