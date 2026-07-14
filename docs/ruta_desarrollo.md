# Hoja de Ruta de Desarrollo: BancaFlow

> **Estado actual:** Funcionalidad core completa. Pendientes de pulido y features secundarios.

---

## ✅ Fase 1: Entorno y UI Base (COMPLETADA)
- Configuración de Tailwind con tokens de diseño Fluent (glassmorphism, Mica effect).
- Layout principal: Sidebar (`w-64`) + Header (`h-[40px]`) + Contenido (`mica-section`).
- Ventana Electron: `transparent: true`, `vibrancy: 'sidebar'`, `backgroundMaterial: 'acrylic'`.

## ✅ Fase 2: Conectividad y Seguridad (COMPLETADA)
- Cliente Supabase con dos modos: anon key (renderer) y service_role key (main process).
- Auth service con login/logout vía `supabase.auth.signInWithPassword`.
- Google Drive OAuth 2.0 Desktop App (no service account). Token cachead en disco.
- Sesión cachead en `currentSession` (no persistSession).

## ✅ Fase 3: Lógica de Negocio (COMPLETADA)
- Formulario de solicitud con validaciones (detracción > 700 Soles, archivos obligatorios).
- Pipeline: archivo → Drive (subida directa, sin compresión Sharp).
- Estados: PENDIENTE → OBSERVADO → PENDIENTE (corregida) | BANCARIZADO.
- Soft delete con columna `deleted_at`.

## ✅ Fase 4: Dashboard y Roles (COMPLETADA)
- Vista Mis Solicitudes (creador ve sus solicitudes, edita observadas).
- Vista Bandeja CFO (solo PENDIENTE, auto-refresh 10s, observar/bancarizar).
- Vista Bancarizados (historial de solicitudes bancarizadas).
- Dashboard con contadores y tabla de recientes.
- Modal de detalle para ver información completa de cualquier solicitud.

## ✅ Fase 5: CRUD Administrativo (COMPLETADA)
- Gestión de Proveedores (CFO/ADMIN).
- Gestión de Bancos (ADMIN).
- Gestión de Sedes (ADMIN).
- Gestión de Usuarios (ADMIN).

## 🔲 Fase 6: Reportes y Cierre (PENDIENTE)
- Exportador Excel (`exceljs`).
- Validación de cierre con bloqueo de estado BANCARIZADO hasta completar sustentos.

## 🔲 Fase 7: Pulido y Compilación (PENDIENTE)
- Iconografía consistente (Lucide Icons).
- Compilación portable: `npm run dist` → `.exe`.
- Smoke tests antes de cada compilación.
