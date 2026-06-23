-- ==========================================
-- SCRIPT DE CONFIGURACIÓN - BANCAFLOW v2
-- ==========================================
-- IMPORTANTE: Ejecutar esto en el SQL Editor de Supabase

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA BANCOS
CREATE TABLE IF NOT EXISTS public.bancos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA SEDES
CREATE TABLE IF NOT EXISTS public.sedes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA PROVEEDORES (modificada)
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

-- 5. TABLA SOLICITUDES (modificada)
CREATE TABLE IF NOT EXISTS public.solicitudes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id),
    proveedor_id UUID NOT NULL REFERENCES public.proveedores(id),
    descripcion TEXT NOT NULL,
    monto NUMERIC(10, 2) NOT NULL,
    requiere_detraccion BOOLEAN DEFAULT false,
    archivos JSONB NOT NULL DEFAULT '[]'::jsonb,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'OBSERVADO', 'BANCARIZADO', 'RECHAZADO')),
    observacion_motivo TEXT,
    evidencias_bancarizacion JSONB DEFAULT '[]'::jsonb,
    bancarizado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
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

-- 8. POLÍTICAS SEDES
CREATE POLICY "Usuarios autenticados pueden ver sedes"
    ON public.sedes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin puede insertar sedes"
    ON public.sedes FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'ADMINISTRADOR'));

CREATE POLICY "Admin puede actualizar sedes"
    ON public.sedes FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'ADMINISTRADOR'));

-- 9. POLÍTICAS PROVEEDORES
CREATE POLICY "CFO y Admin pueden gestionar proveedores"
    ON public.proveedores FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('CFO', 'ADMINISTRADOR')))
    WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('CFO', 'ADMINISTRADOR')));

-- 10. POLÍTICAS SOLICITUDES
-- Usuarios ven sus propias solicitudes
CREATE POLICY "Usuarios ven sus propias solicitudes"
    ON public.solicitudes FOR SELECT TO authenticated
    USING (auth.uid() = usuario_id);

-- Usuarios pueden insertar solicitudes a su nombre
CREATE POLICY "Usuarios pueden insertar solicitudes"
    ON public.solicitudes FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = usuario_id);

-- Usuarios actualizan sus solicitudes observadas
CREATE POLICY "Usuarios actualizan sus solicitudes observadas"
    ON public.solicitudes FOR UPDATE TO authenticated
    USING (auth.uid() = usuario_id AND estado = 'OBSERVADO')
    WITH CHECK (auth.uid() = usuario_id AND estado = 'PENDIENTE');

-- CFO ve y modifica TODO
CREATE POLICY "CFO gestiona todas las solicitudes"
    ON public.solicitudes FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'CFO'))
    WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'CFO'));

-- 11. Función para actualizar updated_at automáticamente
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
