# Ingeniería de Software: BancaFlow (Versión Beta)

Este documento complementa la documentación oficial (`docs.md`) con estándares avanzados de ingeniería, seguridad y control de calidad.

---

## 1. Gestión de Requerimientos y Control de Flujo

### 1.1 Trazabilidad Extendida
Para garantizar la integridad financiera, se implementará un **Log de Auditoría (Audit Trail)** en Supabase:
* **Entidad `audit_logs`:** Registrará cada cambio de estado, ID de usuario, timestamp y valor anterior/nuevo.
* **Flujo de Rechazo:** Si el CFO devuelve una solicitud por inconformidad (RF3.3), el estado cambiará a `DEVUELTO_PARA_CORRECCIÓN`. El solicitante original recibirá la notificación/alerta dentro del sistema para editar los campos señalados.

### 1.2 Resiliencia y Manejo de Fallos (Reliability)
Dado que el sistema depende de APIs externas (Google Drive, Supabase), se aplicarán los siguientes patrones:
* **Transaccionalidad en Dos Fases (Pseudo-2PC):** 
    1. Se sube el archivo a Google Drive.
    2. Si la subida es exitosa, se guarda el registro en Supabase.
    3. Si el paso 2 falla, el sistema debe intentar reintentar el guardado o marcar el archivo en Drive para limpieza automática posterior.
* **Offline Feedback:** Si no hay internet, el botón de "Enviar" se desactiva y se muestra un aviso de "Sin conexión". No se permitirá el encolado local de transacciones financieras para evitar desincronización de saldos.

### 1.3 Lógica de Detracciones (Flexible)
* **Fase 1 (Actual):** Marcado automático `Requiere Detracción = SÍ` si Monto > 700 Soles.
* **Fase 2 (Evolutiva):** El sistema permitirá configurar un `%` manual. Si se define, el sistema calculará: `Monto Detracción = Monto Total * %` y `Neto a Pagar = Monto Total - Detracción`.

---

## 2. Arquitectura de Seguridad y Electron

### 2.1 Patrón Bridge + Context Isolation
Para proteger la aplicación, se prohíbe el acceso directo de la interfaz (Renderer) a Node.js:
* **Preload Script:** Actuará como un "puente" seguro exponiendo solo funciones específicas mediante `contextBridge.exposeInMainWorld`.
* **Seguridad de API Keys:** 
    * *Nota sobre Supabase:* El uso del SDK de Supabase con la `anon_key` es seguro y gratuito por diseño, siempre que se activen las **Políticas de Seguridad de Filas (RLS)** en la base de datos.
    * *Nota sobre Google Drive:* Las credenciales se inyectarán mediante variables de entorno en tiempo de compilación (`dotenv` con Electron Builder).

### 2.2 Concurrencia (Optimistic Locking)
Para evitar que dos usuarios modifiquen una solicitud al mismo tiempo:
* Se usará la columna `updated_at` en Supabase. Si al intentar guardar, la fecha de actualización en la DB es posterior a la que el usuario tiene en pantalla, el sistema lanzará un aviso: *"La solicitud ha sido modificada por otro usuario. Por favor, recargue."*

---

## 3. Estándares de Desarrollo (TypeScript & Electron)

### 3.1 TypeScript "Strict-First"
* **Tipado de Estados:**
  ```typescript
  type SolicitudEstado = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'DEVUELTO' | 'BANCARIZADO';
  ```
* **Interfaces Financieras:** Uso estricto de interfaces para evitar campos opcionales en montos críticos.

### 3.2 Procesamiento de Archivos (Main Process)
* El uso de **Sharp** y **pdf-lib** se ejecutará exclusivamente en el **Main Process**. 
* La comunicación será: `Renderer (Archivo) -> IPC -> Main (Comprimir/Subir) -> IPC -> Renderer (Éxito/Error)`. Esto evita que la aplicación se "congele" visualmente durante procesos pesados.

---

## 4. Aseguramiento de Calidad (QA)

### 4.1 Validación de Datos
* **Precisión Monetaria:** Todas las operaciones de redondeo se realizarán a 2 decimales usando el método de redondeo financiero (Round to nearest even) para evitar fugas de céntimos en reportes masivos.
* **Integridad de Archivos:** Antes de subir a Google Drive, se validará el MIME-type real del archivo (no solo la extensión) para evitar archivos corruptos.

### 4.2 Pruebas de Humo (Smoke Tests)
Se definen 3 pruebas críticas antes de cada compilación del `.exe`:
1. **Login Test:** Verificación de acceso con roles diferenciados.
2. **Compression Test:** Validar que una imagen de 5MB termine pesando <100KB.
3. **Flow Test:** Crear solicitud -> Aprobar CFO -> Marcar Bancarizado.

---

## 5. Notas sobre Gratuidad ($0 USD)

* **Supabase:** El plan "Free" es perpetuo para este volumen de datos (500MB es suficiente para millones de registros de texto).
* **Google Drive:** Los 15GB son gratuitos. El sistema de compresión extrema (WebP) garantiza que el espacio dure años.
* **Infraestructura:** Al ser una App de Escritorio, no pagas por hosting de servidores ni por CPU; el procesamiento lo hace la computadora del usuario.
