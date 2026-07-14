# Documentación Oficial del Sistema: BancaFlow
**Proceso:** Gestión Centralizada de Bancarización
**Costo de Infraestructura:** $0 USD (100% Gratis)
**Tipo de Aplicación:** Escritorio Nativo (`.exe` para Windows vía Electron)

---

## 1. Contexto del Problema y de la Solución

### El Problema (El Caos Actual)
El flujo administrativo actual de la empresa sufre de "islas de información" y una grave falta de control centralizado. Los departamentos de **RRHH**, **Administración** y **Contabilidad** generan solicitudes de pago que se envían al **CFO (Gerente de Finanzas)** de manera informal mediante chats de WhatsApp o compartiéndose un archivo Excel local que cambia de manos constantemente.

Este desorden operativo genera tres riesgos críticos para el negocio:
* **Pérdida de trazabilidad:** No existe un registro histórico fiable de quién solicitó un pago, cuándo fue aprobado por el CFO o si realmente se llegó a bancarizar.
* **Vulnerabilidad fiscal (Detracciones):** Al procesar los montos de forma manual, existe un alto riesgo humano de omitir el depósito de la detracción cuando un servicio supera los **700 Soles**.
* **Desorden documentario:** Los sustentos digitales (XML, PDFs, capturas) quedan dispersos en computadoras individuales o se pierden en el historial de WhatsApp.

### La Solución (El Estado Ideal con BancaFlow)
**BancaFlow** es una aplicación de escritorio centralizada que unifica todo el proceso bajo un único software. Cada área accede al sistema con un rol específico. La información y los documentos ya no viajan por canales informales; ahora se almacenan de forma segura en una base de datos en la nube y en Google Drive.

---

## 2. Arquitectura del Sistema

El sistema adopta una arquitectura **Cliente-Servidor (Serverless)** híbrida, optimizada para operar a costo cero.

```
              +-----------------------------------+
              |    BancaFlow.exe (Electron + TS)  |
              +-----------------------------------+
                /                               \
  (OAuth 2.0 /                                   \ (Guarda Datos y Link
   Sube archivo)                                   \ de Drive en DB)
              v                                    v
+-----------------------------+           +----------------------------+
| Google Drive (Carpeta)      |           | Supabase SQL (Postgres)    |
| - Almacena PDFs e Imágenes  |           | - auth (email/password)    |
| - Capacidad: 15 GB ($0)     |           | - perfiles, solicitudes    |
| - Cuenta personal OAuth 2.0 |           |   proveedores, bancos, etc.|
+-----------------------------+           +----------------------------+

```

### Clientes de Supabase
El sistema usa **dos clientes** de Supabase:
| Cliente | Key | Propósito |
|---------|-----|-----------|
| `supabase` (renderer) | `ANON_KEY` | Login/logout del usuario, `persistSession: false` |
| `supabaseAdmin` (main) | `SERVICE_ROLE_KEY` | Listar solicitudes (bypass RLS para CFO), operaciones admin |

### Autenticación con Google Drive
- **OAuth 2.0 Desktop App** (no service account).
- Se abre un servidor HTTP local + navegador para autorizar.
- El `refresh_token` se guarda en `%APPDATA%\bancaflow\drive_tokens.json`.
- El token se refresca automáticamente vía `oauth2Client.on('tokens')`.

---

## 3. Roles y Permisos

| Rol | Solicitudes | Proveedores | Bancos/Sedes | Usuarios |
|-----|-------------|-------------|--------------|----------|
| **RRHH** | Enviar, arreglar observadas | Ver | Ver | Ver |
| **CONTADOR** | Enviar, arreglar observadas | Ver | Ver | Ver |
| **CFO** | Ver bandeja, aprobar, observar, bancarizar | CRUD | Ver | Ver |
| **ADMIN** | CRUD completo | CRUD | CRUD | CRUD |

- **Bandeja CFO:** solo muestra solicitudes en estado `PENDIENTE`.
- **Mis Solicitudes:** el creador ve sus solicitudes; si están `OBSERVADO`, puede editarlas y reenviarlas.

---

## 4. Flujo de Estados

```
PENDIENTE ──> OBSERVADO ──> PENDIENTE (corregida)
    │
    └──> BANCARIZADO
```

- **PENDIENTE:** Creada, espera revisión del CFO.
- **OBSERVADO:** CFO la rechaza con motivo. El creador puede editarla y reenviarla (vuelve a PENDIENTE).
- **BANCARIZADO:** CFO confirma la transferencia y adjunta evidencias. Estado terminal.

### Soft Delete
- Las solicitudes no se eliminan físicamente. Se asigna `deleted_at` con el timestamp actual.
- Todas las queries filtran con `.is('deleted_at', null)`.
- Solo ADMIN y CFO pueden hacer soft delete.

---

## 5. Tecnologías y su Uso (Costo $0)

| Tecnología | Rol en el Sistema | Justificación de Costo $0 |
|------------|-------------------|---------------------------|
| **Electron** | Framework para aplicaciones de escritorio | Código abierto |
| **TypeScript** | Lenguaje de programación principal | Tipado estricto para evitar errores financieros |
| **Supabase SDK** | Base de datos y autenticación | Plan gratuito: 500 MB |
| **Google Drive API (`googleapis`)** | Almacenamiento de archivos vía OAuth 2.0 | 15 GB gratuitos (cuenta personal) |
| **Electron Builder** | Empaquetado a ejecutable portable | Código abierto |

---

## 6. Funcionalidades de UI

- **Auto-refresh:** Cada 10 segundos se recargan los datos de la vista activa. Al cambiar de pestaña se fuerza recarga.
- **Skeleton loading:** Mientras cargan los datos, las tablas muestran filas esqueleto con shimmer animation.
- **Sistema de toasts:** Reemplaza `alert()` con notificaciones animadas (success, error, warning, info).
- **Modales animados:** Apertura/cierre con animación CSS, cierre con Escape y click en backdrop, auto-foco en primer input.
- **Diálogo de confirmación:** `confirmDialog()` reemplaza `confirm()` con overlay estilizado.
- **Estado de Drive:** Indicador clickeable en el header que muestra el estado real de la conexión a Google Drive.
- **Scrollbar personalizada:** Delgada y semitransparente, consistente con el tema oscuro.

---

## 7. Layout y Estructura Visual

```
+---------------------------------------------+
| SIDEBAR (w-64)    | HEADER (h-[40px])       |
| drag-region        | título | [Drive] [🔔]  |
| pt-10              |           [⚙️]          |
| Logo               |  ← pr-[150px] (botones  |
| Navegación         |    nativos de ventana)  |
| Usuario/logout     |                         |
|--------------------+-------------------------|
|                    | CONTENIDO               |
|                    | mica-section            |
|                    | (scroll, tablas,        |
|                    |  formularios)           |
+---------------------------------------------+
```

### Patrones de tabla
- `table-fixed` + `<colgroup>` con anchos porcentuales (evita scroll horizontal).
- Celdas con `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` excepto columna Acción.
- Botones de acción como iconos Lucide compactos (`p-1.5 rounded-lg`) con colores semánticos.
- Toolbar compacto: buscador y botón "Añadir" en una sola fila.

### Secciones con mica-section
Las vistas principales usan `mica-section`: fondo glass, bordes redondeados, sin `fluent-card` envolvente en la tabla (la tabla va de borde a borde dentro de la sección).

---

## 8. Variables de Entorno (`.env`)

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_DRIVE_FOLDER_ID=...
```

- `SUPABASE_SERVICE_ROLE_KEY`: necesaria para `supabaseAdmin` (bypass RLS).
- Las claves de Google Drive se obtienen desde Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Desktop App.
- La API de Google Drive debe estar habilitada en el proyecto de Google Cloud.

---

## 9. Requerimientos del Sistema

### Funcionales (RF)

#### Gestión de Usuarios y Accesos
- **RF1.1:** Login mediante correo y contraseña usando autenticación nativa de Supabase.
- **RF1.2:** Validación y restricción de pantallas según rol (RRHH, CONTADOR, CFO, ADMIN).

#### Flujo de Solicitudes (RRHH / CONTADOR / ADMIN)
- **RF2.1:** El usuario puede crear solicitud con: Proveedor, Descripción, Monto (Soles) y Sustentos (archivos).
- **RF2.2:** Si monto > 700 Soles, se marca automáticamente `Requiere Detracción`.
- **RF2.3:** El creador puede editar solicitudes en estado OBSERVADO y reenviarlas.

#### Panel de Revisión (CFO)
- **RF3.1:** El CFO ve un tablero con todas las solicitudes en estado PENDIENTE.
- **RF3.2:** El CFO puede OBSERVAR (motivo obligatorio) o BANCARIZAR (evidencias obligatorias).
- **RF3.3:** Auto-refresh cada 10s para ver nuevas solicitudes sin recargar manualmente.

#### Bancarización
- **RF4.1:** El CFO adjunta comprobantes de transferencia bancaria como evidencias.
- **RF4.2:** Una vez bancarizada, la solicitud es terminal (no se puede modificar).

#### Consultas
- **RF5.1:** Todos los roles pueden ver su historial de solicitudes.
- **RF5.2:** Modal de detalle para ver información completa de cualquier solicitud (con sustentos y evidencias).
- **RF5.3:** Dashboard con contadores (pendientes, por bancarizar, bancarizados hoy) y tabla de recientes.

### No Funcionales (RNF)
- **RNF1 (Costo Cero):** Infraestructura = $0 USD permanentemente.
- **RNF2 (Portable):** Único `.exe`, no requiere instalación de Node.js.
- **RNF3 (Seguridad):** API keys manejadas en main process (no expuestas al renderer). Bridge via preload con contextIsolation.
- **RNF4 (Tipado Estricto):** TypeScript strict mode para consistencia financiera.
- **RNF5 (Windows):** Compatible con Windows 10 y 11.
