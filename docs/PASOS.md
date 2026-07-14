# Pasos para Crear y Compilar la Aplicación Electron Portable (TS Edition)

Este documento detalla los pasos exactos realizados para configurar, desarrollar y compilar la aplicación.

## 1. Inicialización del Proyecto
```bash
npm init -y
```

## 2. Instalación de Dependencias
```bash
# Desarrollo
npm install --save-dev electron electron-builder typescript ts-loader tailwindcss @tailwindcss/cli postcss autoprefixer concurrently wait-on

# Producción
npm install @supabase/supabase-js googleapis dotenv
```

## 3. Estructura de Proyecto (Arquitectura Segura)
- `src/main/`: Lógica del proceso principal (Node.js). Contiene IPC handlers, OAuth 2.0 Drive, clientes Supabase.
- `src/preload/`: Puente de comunicación seguro (Context Isolation + contextBridge).
- `src/renderer/`: Interfaz de usuario (HTML/TS/Tailwind). Sin acceso directo a Node.js.
- `assets/`: Recursos estáticos (Logo, iconos).

## 4. Configuración de TypeScript (`tsconfig.json`)
Configurado con `strict: true` para garantizar precisión en cálculos financieros y manejo de estados.

## 5. Configuración de Tailwind (Fluent Design)
Configurado con tokens específicos para imitar la estética de Windows 11:
- Mica effect (glassmorphism)
- Colores neutros oscuros
- Acento celeste (`#60cdff`)

## 6. Scripts de `package.json`
```json
"scripts": {
  "dev": "concurrently -n tsc,tailwind \"npm run watch\" \"npm run tailwind\" \"wait-on dist/main/main.js dist/renderer/css/output.css && electron .\"",
  "watch": "tsc -w",
  "tailwind": "tailwindcss -i ./src/renderer/css/style.css -o ./dist/renderer/css/output.css --watch --minify",
  "build": "tsc && tailwindcss -i ./src/renderer/css/style.css -o ./dist/renderer/css/output.css --minify && electron-builder"
}
```

## 7. Compilación a `.exe` Portable
```bash
npm run build
```
El resultado final aparece en la carpeta **`dist/`** como un único `.exe`.

## 8. Variables de Entorno Requeridas
Crear archivo `.env` en la raíz con:
```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_DRIVE_FOLDER_ID=
```
