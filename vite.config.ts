import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Disable Hot Module Replacement (HMR) to prevent the browser from 
    // automatically refreshing on every file save.
    hmr: false,

    // Alternatively, to completely stop Vite from watching files:
    // watch: {
    //   ignored: ['**/*']
    // }
  },
  // If you want to prevent the browser from reloading even when the server restarts
  // you might need to handle the client-side socket, but hmr: false usually suffices
  // to stop the 'push' behavior.
});
