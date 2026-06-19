import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  auth: {
    login: (correo: string, contrasena: string) => ipcRenderer.invoke('auth:login', { correo, contrasena }),
    logout: () => ipcRenderer.invoke('auth:logout'),
    obtenerSesion: () => ipcRenderer.invoke('auth:get-session')
  },
  drive: {
    testConnection: () => ipcRenderer.invoke('drive:test-connection'),
    uploadFile: (name: string, mimeType: string, base64Data: string) => 
      ipcRenderer.invoke('drive:upload', { name, mimeType, base64Data }),
    uploadOptimized: (name: string, mimeType: string, base64Data: string) =>
      ipcRenderer.invoke('drive:upload-optimized', { name, mimeType, base64Data })
  },
  db: {
    crearSolicitud: (datos: {
      proveedor: string;
      descripcion: string;
      monto: number;
      requiereDetraccion: boolean;
      archivoNombre: string;
      archivoDriveId: string;
      archivoDriveUrl: string;
    }) => ipcRenderer.invoke('db:crear-solicitud', datos),
    listarSolicitudes: () => ipcRenderer.invoke('db:listar-solicitudes')
  }
});
