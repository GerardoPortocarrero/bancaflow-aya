# Hoja de Ruta de Desarrollo: BancaFlow (Fluent Design Edition)

Esta ruta organiza la construcción del sistema en fases lógicas, priorizando la seguridad y la estética de Windows 11.

---

## Fase 1: Entorno y UI Base (Fluent Design)
*   **Configuración de Tailwind:** Instalación y configuración de `tailwind.config.js`.
*   **Definición de Tokens de Diseño:**
    *   **Colores:** Usar la paleta de Windows (Neutral Grays, Accent Blue).
    *   **Efectos:** Configurar clases para `glassmorphism` (Efecto Mica).
*   **Layout Principal:** Crear la ventana con una barra lateral (Sidebar) semi-transparente y un área de contenido con bordes redondeados (`rounded-xl`).

## Fase 2: Conectividad y Seguridad (Backend-less)
*   **Supabase Setup:** Configurar el cliente de Supabase en el proceso de Electron.
*   **Auth Service:** Crear la pantalla de Login con validación visual.
*   **Google Drive Bridge:** Configurar la cuenta de servicio en el `Main Process` para recibir archivos desde la UI.

## Fase 3: Lógica de Negocio y Procesamiento
*   **Formulario de Solicitud:** Implementar validaciones de campos y el aviso de detracciones (>700 Soles).
*   **Pipeline de Archivos:**
    1.  Usuario arrastra archivo.
    2.  `Main Process` recibe el buffer.
    3.  **Sharp** comprime (WebP).
    4.  Subida a Google Drive.
    5.  Registro en Supabase con la URL resultante.

## Fase 4: Dashboard y Roles
*   **Vista Solicitante:** Historial de sus propias solicitudes.
*   **Vista CFO:** Tabla con efecto `hover` estilo Fluent para revisar y aprobar.
*   **Módulo de Corrección:** Flujo para que el CFO devuelva solicitudes con comentarios.

## Fase 5: Reportes y Cierre
*   **Exportador Excel:** Integración con `exceljs`.
*   **Validación de Cierre:** Bloqueo de estado `BANCARIZADO` hasta que existan los sustentos obligatorios.

## Fase 6: Pulido y Compilación
*   **Iconografía:** Usar "Segoe Fluent Icons" o "Lucide Icons" para mantener la estética.
*   **Compilación Portable:** Ejecutar `npm run dist` y testear el `.exe` en una máquina limpia (sin Node.js instalado).
