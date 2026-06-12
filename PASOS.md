# Pasos para Crear y Compilar la Aplicación Electron Portable (TS Edition)

Este documento detalla los pasos exactos realizados para configurar, desarrollar y compilar la aplicación.

## 1. Inicialización del Proyecto
```bash
npm init -y
```

## 2. Instalación de Dependencias
```bash
# Desarrollo: Electron, TypeScript, Tailwind, Builder
npm install --save-dev electron electron-builder typescript ts-loader tailwindcss @tailwindcss/cli postcss autoprefixer concurrently wait-on

# Producción: Sharp, Supabase, Google Drive, PDF-Lib
npm install sharp pdf-lib @supabase/supabase-js googleapis dotenv
```

## 3. Estructura de Proyecto (Arquitectura Segura)
Se ha creado la siguiente estructura para cumplir con el patrón Bridge:
- `src/main/`: Lógica del proceso principal (Node.js).
- `src/preload/`: Puente de comunicación seguro (Context Isolation).
- `src/renderer/`: Interfaz de usuario (HTML/TS/Tailwind).
- `assets/`: Recursos estáticos (Iconos).

## 4. Configuración de TypeScript (`tsconfig.json`)
Configurado con `strict: true` para garantizar precisión en cálculos financieros y manejo de estados.

## 5. Configuración de Tailwind (Fluent Design)
Configurado en `tailwind.config.js` con tokens específicos para imitar la estética de Windows 11 (Mica effect, Neutral Grays).

## 6. Configuración del `package.json`
Modificado para incluir el target portable y scripts de desarrollo:
```json
"scripts": {
  "start": "concurrently \"npm run watch\" \"wait-on dist/main/main.js && electron .\"",
  "watch": "tsc -w",
  "build": "tsc && electron-builder"
}
```
*El resultado final aparecerá en la carpeta **`dist/`** como un único .exe.*
