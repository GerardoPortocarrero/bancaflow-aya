-- ==========================================
-- SCRIPT DE CONFIGURACIÓN - BANCAFLOW v2
-- ==========================================
-- IMPORTANTE: Ejecutar esto en el SQL Editor de Supabase
-- (después de ejecutar setup_supabase.sql)

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA BANCOS
CREATE TABLE IF NOT EXISTS public.bancos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    moneda TEXT NOT NULL DEFAULT 'Soles' CHECK (moneda IN ('Dolares', 'Soles')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (nombre, moneda)
);

-- 3. TABLA SEDES
CREATE TABLE IF NOT EXISTS public.sedes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA PROVEEDORES
CREATE TABLE IF NOT EXISTS public.proveedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_razon_social TEXT NOT NULL,
    correo TEXT,
    banco_id UUID REFERENCES public.bancos(id),
    numero_cuenta TEXT,
    sede_id UUID REFERENCES public.sedes(id),
    cci TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABLA SOLICITUDES (con soft delete)
CREATE TABLE IF NOT EXISTS public.solicitudes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id),
    proveedor_id UUID NOT NULL REFERENCES public.proveedores(id),
    descripcion TEXT NOT NULL,
    monto NUMERIC(10, 2) NOT NULL,
    requiere_detraccion BOOLEAN DEFAULT false,
    archivos JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Estados reales del sistema: PENDIENTE, OBSERVADO, BANCARIZADO
    estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'OBSERVADO', 'BANCARIZADO')),
    observacion_motivo TEXT,
    evidencias_bancarizacion JSONB DEFAULT '[]'::jsonb,
    bancarizado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Soft delete: en lugar de borrar, se asigna timestamp
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- 6. SEGURIDAD (Row Level Security)
ALTER TABLE public.bancos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes ENABLE ROW LEVEL SECURITY;

-- 7. POLÍTICAS BANCOS
CREATE POLICY "Usuarios autenticados pueden ver bancos"
    ON public.bancos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin puede insertar bancos"
    ON public.bancos FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'ADMINISTRADOR'));

CREATE POLICY "Admin puede actualizar bancos"
    ON public.bancos FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'ADMINISTRADOR'));

CREATE POLICY "Admin puede eliminar bancos"
    ON public.bancos FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'ADMINISTRADOR'));

-- 8. POLÍTICAS SEDES
CREATE POLICY "Usuarios autenticados pueden ver sedes"
    ON public.sedes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin puede insertar sedes"
    ON public.sedes FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'ADMINISTRADOR'));

CREATE POLICY "Admin puede actualizar sedes"
    ON public.sedes FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'ADMINISTRADOR'));

CREATE POLICY "Admin puede eliminar sedes"
    ON public.sedes FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'ADMINISTRADOR'));

-- 9. POLÍTICAS PROVEEDORES
-- Todos los autenticados pueden VER proveedores
CREATE POLICY "Todos pueden ver proveedores"
    ON public.proveedores FOR SELECT TO authenticated
    USING (true);

-- Solo CFO y ADMIN pueden crear, actualizar y eliminar proveedores
CREATE POLICY "CFO y Admin pueden insertar proveedores"
    ON public.proveedores FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('CFO', 'ADMINISTRADOR')));

CREATE POLICY "CFO y Admin pueden actualizar proveedores"
    ON public.proveedores FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('CFO', 'ADMINISTRADOR')));

CREATE POLICY "CFO y Admin pueden eliminar proveedores"
    ON public.proveedores FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('CFO', 'ADMINISTRADOR')));

-- 10. POLÍTICAS SOLICITUDES
-- Usuarios ven sus propias solicitudes (no eliminadas)
CREATE POLICY "Usuarios ven sus propias solicitudes"
    ON public.solicitudes FOR SELECT TO authenticated
    USING (auth.uid() = usuario_id AND deleted_at IS NULL);

-- Usuarios pueden insertar solicitudes a su nombre
CREATE POLICY "Usuarios pueden insertar solicitudes"
    ON public.solicitudes FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = usuario_id);

-- Usuarios actualizan sus solicitudes observadas
CREATE POLICY "Usuarios actualizan sus solicitudes observadas"
    ON public.solicitudes FOR UPDATE TO authenticated
    USING (auth.uid() = usuario_id AND estado = 'OBSERVADO' AND deleted_at IS NULL)
    WITH CHECK (auth.uid() = usuario_id AND estado = 'OBSERVADO');

-- CFO ve TODAS las solicitudes no eliminadas
-- (También existe un bypass via supabaseAdmin en main.ts para la bandeja)
CREATE POLICY "CFO gestiona todas las solicitudes"
    ON public.solicitudes FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'CFO') AND deleted_at IS NULL)
    WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'CFO'));

-- Admin y CFO pueden hacer soft delete
CREATE POLICY "Admin y CFO pueden eliminar solicitudes"
    ON public.solicitudes FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('CFO', 'ADMINISTRADOR')) AND deleted_at IS NULL)
    WITH CHECK (deleted_at IS NOT NULL);

-- 11. TABLA NOTIFICACIONES
CREATE TABLE IF NOT EXISTS public.notificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('nueva_solicitud', 'rebote', 'bancarizado', 'eliminado')),
    mensaje TEXT NOT NULL,
    solicitud_id UUID REFERENCES public.solicitudes(id) ON DELETE SET NULL,
    leido BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- Usuarios ven sus propias notificaciones
CREATE POLICY "Usuarios ven sus notificaciones"
    ON public.notificaciones FOR SELECT TO authenticated
    USING (auth.uid() = usuario_id);

-- Usuarios marcan sus notificaciones como leídas
CREATE POLICY "Usuarios actualizan sus notificaciones"
    ON public.notificaciones FOR UPDATE TO authenticated
    USING (auth.uid() = usuario_id);

-- Usuarios eliminan sus notificaciones
CREATE POLICY "Usuarios eliminan sus notificaciones"
    ON public.notificaciones FOR DELETE TO authenticated
    USING (auth.uid() = usuario_id);

-- 12. Función para actualizar updated_at automáticamente
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

-- ==========================================
-- NOTAS DE ARQUITECTURA
-- ==========================================
-- La app utiliza dos clientes de Supabase:
--   anon key (persistSession: false) → operaciones del usuario logueado
--   service_role key (supabaseAdmin)  → listar-solicitudes (bandeja CFO),
--                                        operaciones de admin
-- El filtro deleted_at IS NULL se aplica tanto en RLS como en las queries
-- del backend (main.ts) para garantizar soft delete consistente.
