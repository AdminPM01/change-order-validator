import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './change_order_validator.jsx'
 
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)