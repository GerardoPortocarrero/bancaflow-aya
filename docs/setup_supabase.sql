-- SCRIPT DE CONFIGURACIÓN INICIAL: BancaFlow
-- Ejecuta este código en el "SQL Editor" de tu panel de Supabase.

-- 1. Crear tabla de perfiles (Vinculada a la autenticación nativa)
CREATE TABLE perfiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  rol TEXT CHECK (rol IN ('ADMINISTRADOR', 'CONTADOR', 'CFO', 'RRHH', 'SOLICITANTE')) DEFAULT 'SOLICITANTE',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar Seguridad de Filas (RLS)
-- Esto garantiza que nadie pueda leer datos de otros sin permiso.
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- 3. Crear Política de Lectura
-- Permite que los usuarios autenticados lean su propio perfil.
CREATE POLICY "Los usuarios pueden ver su propio perfil" 
ON perfiles FOR SELECT 
USING (auth.uid() = id);

-- 4. Crear Política de Actualización
-- Permite que los usuarios actualicen su propia información.
CREATE POLICY "Los usuarios pueden editar su propio perfil" 
ON perfiles FOR UPDATE 
USING (auth.uid() = id);
