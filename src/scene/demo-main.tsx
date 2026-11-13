import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SceneDemo } from './demo'

const style = document.createElement('style')
style.textContent = `
  :root { --night:#0f1b33; --air:#56b4e9; --power:#f0e442; --plants:#009e73; --radiation:#d55e00; color-scheme: dark }
  body { margin:0; background:#0f1b33; color:#f2efe8; font-family:'Nunito',system-ui,sans-serif }
  .demo { max-width:520px; margin:0 auto; padding:8px 8px 16px; display:flex; flex-direction:column; gap:8px }
  .demo-bar { display:flex; gap:8px; align-items:center; justify-content:center; height:36px }
  .demo-bar button { min-height:36px; min-width:44px; border-radius:10px; border:2px solid #34476e; background:#1a2a4a; color:#f2efe8; font:inherit }
  .demo-bar b { min-width:150px; text-align:center }
`
document.head.appendChild(style)

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')
createRoot(root).render(
  <StrictMode>
    <SceneDemo />
  </StrictMode>,
)
