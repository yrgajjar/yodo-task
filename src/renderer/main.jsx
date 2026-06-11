import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Check query string to identify whether this is the spotlight mini window
const params = new URLSearchParams(window.location.search);
const isMini = params.get('window') === 'mini';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App isMini={isMini} />
  </React.StrictMode>
);
