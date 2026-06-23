import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    login: (correo: string, contrasena: string) => ipcRenderer.invoke('auth:login', { correo, contrasena }),
    logout: () => ipcRenderer.invoke('auth:logout'),
    obtenerSesion: () => ipcRenderer.invoke('auth:get-session'),
    crearUsuario: (datos: any) => ipcRenderer.invoke('auth:crear-usuario', datos),
    listarUsuarios: () => ipcRenderer.invoke('auth:listar-usuarios'),
  },
  drive: {
    testConnection: () => ipcRenderer.invoke('drive:test-connection'),
    uploadFile: (name: string, mimeType: string, base64Data: string) =>
      ipcRenderer.invoke('drive:upload-file', { name, mimeType, base64Data }),
  },
  db: {
    listarBancos: () => ipcRenderer.invoke('db:listar-bancos'),
    crearBanco: (nombre: string) => ipcRenderer.invoke('db:crear-banco', { nombre }),
    listarSedes: () => ipcRenderer.invoke('db:listar-sedes'),
    crearSede: (nombre: string) => ipcRenderer.invoke('db:crear-sede', { nombre }),
    listarProveedores: () => ipcRenderer.invoke('db:listar-proveedores'),
    crearProveedor: (datos: any) => ipcRenderer.invoke('db:crear-proveedor', datos),
    crearSolicitud: (datos: any) => ipcRenderer.invoke('db:crear-solicitud', datos),
    listarSolicitudes: (vista: string, rol: string) => ipcRenderer.invoke('db:listar-solicitudes', { vista, rol }),
    observarSolicitud: (id: string, motivo: string) => ipcRenderer.invoke('db:observar-solicitud', { id, motivo }),
    bancarizarSolicitud: (id: string, evidencias: any[]) => ipcRenderer.invoke('db:bancarizar-solicitud', { id, evidencias }),
    actualizarSolicitud: (datos: any) => ipcRenderer.invoke('db:actualizar-solicitud', datos),
  },
});
