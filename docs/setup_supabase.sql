-- SCRIPT DE CONFIGURACIÓN INICIAL: BancaFlow
-- Ejecuta este código en el "SQL Editor" de tu panel de Supabase.

-- 1. Crear tabla de perfiles (Vinculada a la autenticación nativa)
CREATE TABLE perfiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  rol TEXT CHECK (rol IN ('ADMINISTRADOR', 'CONTADOR', 'CFO', 'RRHH')) DEFAULT 'RRHH',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar Seguridad de Filas (RLS)
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- 3. Crear Política de Lectura Propia
-- Permite que los usuarios autenticados lean su propio perfil.
CREATE POLICY "Los usuarios pueden ver su propio perfil"
ON perfiles FOR SELECT
USING (auth.uid() = id);

-- 4. Política de Lectura Global
-- Permite que cualquier usuario autenticado vea todos los perfiles.
-- Necesario para mostrar nombres en tablas, selects de usuarios, etc.
CREATE POLICY "Usuarios autenticados pueden ver todos los perfiles"
ON perfiles FOR SELECT
USING (auth.role() = 'authenticated');

-- 5. Crear Política de Actualización
-- Permite que los usuarios editen su propia información.
CREATE POLICY "Los usuarios pueden editar su propio perfil"
ON perfiles FOR UPDATE
USING (auth.uid() = id);

-- NOTA: La app usa una service_role key (supabaseAdmin) en el main process
-- para operaciones que requieren bypass de RLS, como listar solicitudes
-- de todos los usuarios para la bandeja del CFO.
-- La anon_key se usa solo desde el renderer con persistSession: false.
