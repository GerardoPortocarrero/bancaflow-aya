ALTER TABLE solicitudes ADD COLUMN servicio_id UUID REFERENCES servicios(id);
