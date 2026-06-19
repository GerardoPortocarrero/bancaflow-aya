-- SCRIPT DE CONFIGURACIÓN: Tabla de Solicitudes (BancaFlow - Fase 3)
-- Ejecuta este código en el "SQL Editor" de tu panel de Supabase.
-- IMPORTANTE: Ejecuta DESPUÉS de haber corrido setup_supabase.sql (tabla perfiles).

-- 1. Crear tabla de solicitudes de pago
CREATE TABLE solicitudes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitante_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  proveedor TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  requiere_detraccion BOOLEAN DEFAULT FALSE,
  archivo_nombre TEXT,
  archivo_drive_id TEXT,
  archivo_drive_url TEXT,
  estado TEXT CHECK (estado IN ('PENDIENTE','APROBADO','RECHAZADO','DEVUELTO','BANCARIZADO')) DEFAULT 'PENDIENTE',
  motivo_rechazo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar Seguridad de Filas (RLS)
ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;

-- 3. Política de INSERCIÓN: Cualquier usuario autenticado puede crear solicitudes
CREATE POLICY "Usuarios autenticados pueden crear solicitudes"
ON solicitudes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = solicitante_id);

-- 4. Política de LECTURA: Cada usuario ve sus propias solicitudes
CREATE POLICY "Usuarios ven sus propias solicitudes"
ON solicitudes FOR SELECT
TO authenticated
USING (auth.uid() = solicitante_id);

-- 5. Política de LECTURA para CFO: El CFO puede ver TODAS las solicitudes
-- (Se identifica por su rol en la tabla perfiles)
CREATE POLICY "CFO puede ver todas las solicitudes"
ON solicitudes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM perfiles
    WHERE perfiles.id = auth.uid()
    AND perfiles.rol = 'CFO'
  )
);

-- 6. Política de ACTUALIZACIÓN para CFO: Solo el CFO puede cambiar estado
CREATE POLICY "CFO puede actualizar solicitudes"
ON solicitudes FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM perfiles
    WHERE perfiles.id = auth.uid()
    AND perfiles.rol = 'CFO'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM perfiles
    WHERE perfiles.id = auth.uid()
    AND perfiles.rol = 'CFO'
  )
);

-- 7. Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_solicitudes_updated_at
  BEFORE UPDATE ON solicitudes
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_updated_at();
