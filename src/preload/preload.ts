import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    login: (correo: string, contrasena: string) => ipcRenderer.invoke('auth:login', { correo, contrasena }),
    logout: () => ipcRenderer.invoke('auth:logout'),
    obtenerSesion: () => ipcRenderer.invoke('auth:get-session'),
    crearUsuario: (datos: any) => ipcRenderer.invoke('auth:crear-usuario', datos),
    listarUsuarios: () => ipcRenderer.invoke('auth:listar-usuarios'),
    actualizarUsuario: (id: string, nombre: string, apellido: string, rol: string) =>
      ipcRenderer.invoke('auth:actualizar-usuario', { id, nombre, apellido, rol }),
    eliminarUsuario: (id: string) => ipcRenderer.invoke('auth:eliminar-usuario', { id }),
  },
  drive: {
    testConnection: () => ipcRenderer.invoke('drive:test-connection'),
    uploadFile: (name: string, mimeType: string, base64Data: string) =>
      ipcRenderer.invoke('drive:upload-file', { name, mimeType, base64Data }),
  },
  db: {
    listarBancos: () => ipcRenderer.invoke('db:listar-bancos'),
    crearBanco: (nombre: string, moneda: string) => ipcRenderer.invoke('db:crear-banco', { nombre, moneda }),
    actualizarBanco: (id: string, nombre: string, moneda: string) =>
      ipcRenderer.invoke('db:actualizar-banco', { id, nombre, moneda }),
    eliminarBanco: (id: string) => ipcRenderer.invoke('db:eliminar-banco', { id }),
    listarSedes: () => ipcRenderer.invoke('db:listar-sedes'),
    crearSede: (nombre: string) => ipcRenderer.invoke('db:crear-sede', { nombre }),
    actualizarSede: (id: string, nombre: string) => ipcRenderer.invoke('db:actualizar-sede', { id, nombre }),
    eliminarSede: (id: string) => ipcRenderer.invoke('db:eliminar-sede', { id }),
    listarProveedores: () => ipcRenderer.invoke('db:listar-proveedores'),
    listarPerfiles: () => ipcRenderer.invoke('db:listar-perfiles'),
    crearProveedor: (datos: any) => ipcRenderer.invoke('db:crear-proveedor', datos),
    actualizarProveedor: (id: string, datos: any) => ipcRenderer.invoke('db:actualizar-proveedor', { id, ...datos }),
    eliminarProveedor: (id: string) => ipcRenderer.invoke('db:eliminar-proveedor', { id }),
    crearSolicitud: (datos: any) => ipcRenderer.invoke('db:crear-solicitud', datos),
    listarSolicitudes: (vista: string, rol: string) => ipcRenderer.invoke('db:listar-solicitudes', { vista, rol }),
    observarSolicitud: (id: string, motivo: string) => ipcRenderer.invoke('db:observar-solicitud', { id, motivo }),
    bancarizarSolicitud: (id: string, evidencias: any[]) => ipcRenderer.invoke('db:bancarizar-solicitud', { id, evidencias }),
    actualizarSolicitud: (datos: any) => ipcRenderer.invoke('db:actualizar-solicitud', datos),
    eliminarSolicitud: (id: string) => ipcRenderer.invoke('db:eliminar-solicitud', { id }),
    obtenerSolicitud: (id: string) => ipcRenderer.invoke('db:obtener-solicitud', { id }),
  },
});
