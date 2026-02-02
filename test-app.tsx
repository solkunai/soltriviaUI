// Simple test to see if React renders at all
import React from 'react';
import ReactDOM from 'react-dom/client';

const TestApp = () => {
  return (
    <div style={{ padding: '40px', color: 'white', background: '#050505', minHeight: '100vh' }}>
      <h1>✅ React is working!</h1>
      <p>If you see this, React is rendering correctly.</p>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<TestApp />);
}
