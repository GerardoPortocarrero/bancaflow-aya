# Ingeniería de Software: BancaFlow (Versión Beta)

Este documento complementa la documentación oficial (`docs.md`) con estándares avanzados de ingeniería, seguridad y control de calidad.

---

## 1. Gestión de Requerimientos y Control de Flujo

### 1.1 Trazabilidad
Se implementa un registro de cambios vía la columna `updated_at` (trigger automático). Cada modificación a una solicitud queda registrada con timestamp.

### 1.2 Resiliencia y Manejo de Fallos
* **Subida a Google Drive:** Se sube el archivo primero. Si falla, se muestra el error al usuario y no se crea la solicitud.
* **OAuth 2.0:** Timeout de 5 minutos en la autorización. Si expira, se muestra mensaje de error. El token se refresca automáticamente.
* **Offline:** Si no hay conexión a Supabase o Drive, se muestra toast de error. No se permite encolado local de transacciones.

### 1.3 Lógica de Detracciones
* **Actual:** Marcado automático `Requiere Detracción = SÍ` si Monto > 700 Soles. Se muestra alerta visual en el formulario.

---

## 2. Arquitectura de Seguridad y Electron

### 2.1 Patrón Bridge + Context Isolation
* **Preload Script:** Actúa como puente seguro mediante `contextBridge.exposeInMainWorld`. El renderer solo accede a funciones específicas (nunca a Node.js directamente).
* **Dos Clientes Supabase:**
  * `supabase` (anon key, `persistSession: false`): usado desde el renderer para login/logout.
  * `supabaseAdmin` (service_role key): usado exclusivamente en main process para operaciones que requieren bypass de RLS (listar solicitudes para CFO, CRUD administativo).
* **Google Drive OAuth 2.0:**
  * Autenticación vía OAuth 2.0 Desktop App (cuenta personal).
  * Servidor HTTP local para recibir el callback de autorización.
  * Token guardado en `%APPDATA%\bancaflow\drive_tokens.json`.
  * `refresh_token` se renueva automáticamente.

### 2.2 Estados del Sistema (Tipado Estricto)
```typescript
type SolicitudEstado = 'PENDIENTE' | 'OBSERVADO' | 'BANCARIZADO';
```
* **PENDIENTE:** Creada, esperando revisión del CFO.
* **OBSERVADO:** CFO devuelve con motivo. El creador puede editarla y reenviarla.
* **BANCARIZADO:** CFO confirma la transferencia. Estado terminal.

### 2.3 Soft Delete
* Las solicitudes no se eliminan físicamente. Columna `deleted_at TIMESTAMP DEFAULT NULL`.
* Todas las queries filtran con `.is('deleted_at', null)`.
* Solo ADMIN y CFO pueden realizar soft delete (vía policy RLS y validación en backend).

---

## 3. Estándares de Desarrollo (TypeScript & Electron)

### 3.1 TypeScript Strict Mode
* **Tipado del objeto `window.electronAPI`:** Definido en `renderer.ts` con interfaces detalladas para cada método IPC.
* **Todo el código en main.ts y renderer.ts** está tipado estrictamente.

### 3.2 Comunicación IPC
* `Renderer → Main`: `ipcRenderer.invoke()` / `ipcMain.handle()`.
* `Main → Renderer`: `mainWindow.webContents.send()` / `ipcRenderer.on()`.
* Nunca se expone `ipcRenderer` directamente al renderer.

---

## 4. Aseguramiento de Calidad (QA)

### 4.1 Validación de Datos
* **Precisión Monetaria:** Todas las operaciones de redondeo a 2 decimales usando `Number(monto).toFixed(2)`.
* **Integridad de Archivos:** Se validan tipos MIME mediante la extensión del archivo antes de subir.

### 4.2 Pruebas de Humo (Smoke Tests)
Antes de cada compilación del `.exe`:
1. **Login Test:** Verificación de acceso con roles diferenciados.
2. **Flow Test:** Crear solicitud → CFO observa → Creador corrige → CFO bancariza.
3. **Drive Test:** Subida de archivos a Google Drive vía OAuth 2.0.

---

## 5. Notas sobre Gratuidad ($0 USD)

* **Supabase:** El plan "Free" es perpetuo (500 MB es suficiente para millones de registros de texto).
* **Google Drive:** Los 15 GB son gratuitos. El token de OAuth 2.0 no tiene costo.
* **Infraestructura:** Al ser una App de Escritorio, no pagas por hosting de servidores.
