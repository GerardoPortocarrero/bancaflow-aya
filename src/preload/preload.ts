import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  // Aquí expondremos las funciones seguras para Supabase y Drive luego
});
