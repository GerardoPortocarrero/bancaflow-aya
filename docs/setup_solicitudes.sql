-- ==========================================
-- SCRIPT DE CONFIGURACIÓN BÁSICA - BANCAFLOW
-- ==========================================
-- IMPORTANTE: Ejecutar esto en el SQL Editor de Supabase

-- 1. Habilitar la extensión UUID si no existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Crear tabla de PROVEEDORES
CREATE TABLE IF NOT EXISTS public.proveedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_razon_social TEXT NOT NULL,
    correo TEXT,
    banco TEXT,
    cuenta_bancaria TEXT,
    cci TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Crear tabla de SOLICITUDES
CREATE TABLE IF NOT EXISTS public.solicitudes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id),
    proveedor_id UUID NOT NULL REFERENCES public.proveedores(id),
    descripcion TEXT NOT NULL,
    monto NUMERIC(10, 2) NOT NULL,
    requiere_detraccion BOOLEAN DEFAULT false,
    archivo_nombre TEXT NOT NULL,
    archivo_drive_id TEXT NOT NULL,
    archivo_drive_url TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'OBSERVADO', 'APROBADO', 'BANCARIZADO', 'RECHAZADO')),
    observacion_motivo TEXT, -- Para cuando el CFO devuelva la solicitud
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. SEGURIDAD (Row Level Security)
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS PROVEEDORES
-- Todos los usuarios autenticados pueden ver proveedores
CREATE POLICY "Cualquiera autenticado puede ver proveedores"
    ON public.proveedores FOR SELECT
    TO authenticated
    USING (true);

-- Todos los usuarios autenticados pueden insertar proveedores
CREATE POLICY "Cualquiera autenticado puede insertar proveedores"
    ON public.proveedores FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 6. POLÍTICAS SOLICITUDES
-- Los usuarios solo pueden ver SUS PROPIAS solicitudes
CREATE POLICY "Usuarios ven sus propias solicitudes"
    ON public.solicitudes FOR SELECT
    TO authenticated
    USING (auth.uid() = usuario_id);

-- Los usuarios pueden insertar solicitudes a su nombre
CREATE POLICY "Usuarios pueden insertar solicitudes"
    ON public.solicitudes FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = usuario_id);

-- Los usuarios pueden actualizar SUS PROPIAS solicitudes (cuando están OBSERVADAS)
CREATE POLICY "Usuarios actualizan sus solicitudes observadas"
    ON public.solicitudes FOR UPDATE
    TO authenticated
    USING (auth.uid() = usuario_id AND estado = 'OBSERVADO');

-- ==========================================
-- ATENCIÓN: POLÍTICA DEL CFO Y ADMIN
-- Para permitir que el CFO o ADMIN vea y modifique todo, 
-- debemos basarnos en la tabla `perfiles` que Supabase 
-- crea mediante Triggers o manualmente.
-- ==========================================
-- CFO / ADMIN pueden ver TODO
CREATE POLICY "CFO y Admin ven todo"
    ON public.solicitudes FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE perfiles.id = auth.uid() 
            AND perfiles.rol IN ('CFO', 'ADMINISTRADOR')
        )
    );

-- CFO / ADMIN pueden modificar TODO (cambiar estado)
CREATE POLICY "CFO y Admin actualizan todo"
    ON public.solicitudes FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE perfiles.id = auth.uid() 
            AND perfiles.rol IN ('CFO', 'ADMINISTRADOR')
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

DROP TRIGGER IF EXISTS trigger_solicitudes_updated_at ON public.solicitudes;
CREATE TRIGGER trigger_solicitudes_updated_at
  BEFORE UPDATE ON public.solicitudes
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_updated_at();
