import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  auth: {
    login: (correo: string, contrasena: string) => ipcRenderer.invoke('auth:login', { correo, contrasena }),
    logout: () => ipcRenderer.invoke('auth:logout'),
    obtenerSesion: () => ipcRenderer.invoke('auth:get-session')
  }
});
