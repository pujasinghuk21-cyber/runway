import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /*
   * The site lives at pujasinghuk21-cyber.github.io/runway/, not at the root
   * of a domain, so every asset has to be requested from /runway/ too. Left
   * at the default '/', the page loads and then asks for /assets/index.js,
   * which on GitHub Pages is somebody else's repository or nothing at all,
   * and you get a blank white screen with no error worth reading.
   *
   * Change this to '/' if it ever moves to its own domain.
   */
  base: '/runway/',
})
