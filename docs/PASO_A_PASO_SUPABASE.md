# Guía de Activación de BancaFlow: Paso a Paso (Supabase)

Sigue estos pasos para que el sistema de autenticación pase de ser una maqueta visual a un sistema real y funcional.

---

### Paso 1: Configurar la Base de Datos en la Nube
1.  Entra a tu proyecto en [Supabase](https://supabase.com/).
2.  En el menú lateral izquierdo, haz clic en **SQL Editor**.
3.  Ejecuta estos scripts en orden:
    - Primero: abre `docs/setup_supabase.sql`, copia todo el contenido y ejecútalo.
    - Segundo: abre `docs/setup_solicitudes.sql`, copia todo el contenido y ejecútalo.

### Paso 2: Obtener tus Llaves de Acceso (API)
1.  En Supabase, ve a **Project Settings** (el icono de engranaje abajo a la izquierda).
2.  Haz clic en la sección **API**.
3.  Busca y copia estos valores:
    - **Project URL** (ej: `https://xyz.supabase.co`)
    - **API Key (anon/public)** — la llave pública para el cliente del renderer.
    - **service_role key** — La encuentras en la misma sección API, abajo en "JWT Settings" o como `service_role` key. **Nunca expongas esta llave al frontend.**

### Paso 3: Configurar Google Drive OAuth 2.0
1.  Ve a [Google Cloud Console](https://console.cloud.google.com/).
2.  Crea un proyecto o selecciona uno existente.
3.  Habilita la **Google Drive API**.
4.  Ve a **APIs & Services → Credentials**.
5.  Crea una credencial de tipo **OAuth 2.0 Desktop App**.
6.  Copia el **Client ID** y **Client Secret**.
7.  En la misma consola, crea una carpeta en tu Google Drive personal y copia su **Folder ID** (está en la URL al abrir la carpeta: `https://drive.google.com/drive/folders/ACA_VA_EL_ID`).

### Paso 4: Configurar BancaFlow Localmente
1.  En la carpeta raíz del proyecto, crea o edita el archivo **`.env`**.
2.  Pega todas las llaves con este formato exacto:
    ```env
    SUPABASE_URL=pega_aqui_tu_url
    SUPABASE_ANON_KEY=pega_aqui_tu_llave_anon
    SUPABASE_SERVICE_ROLE_KEY=pega_aqui_tu_service_role_key
    GOOGLE_CLIENT_ID=pega_aqui_tu_client_id
    GOOGLE_CLIENT_SECRET=pega_aqui_tu_client_secret
    GOOGLE_DRIVE_FOLDER_ID=pega_aqui_tu_folder_id
    ```

### Paso 5: Crear tu primer Usuario Administrador
1.  En Supabase, ve a **Authentication > Users**.
2.  Haz clic en **Add User > Create new user**.
3.  Escribe el correo y contraseña que quieras usar para probar.
4.  **MUY IMPORTANTE:** Una vez creado, verás el **User UID**. Cópialo.
5.  Ve a **Table Editor > perfiles**.
6.  Haz clic en **Insert row** y rellena así:
    *   `id`: Pega el UID que acabas de copiar.
    *   `nombre`: Tu nombre.
    *   `apellido`: Tu apellido.
    *   `rol`: Escribe **`ADMINISTRADOR`** (en mayúsculas).
7.  Haz clic en **Save**.

---

### ¡Listo para Probar!
Ahora abre la terminal en tu computadora y ejecuta:
```bash
npm run dev
```
Ingresa el correo y contraseña que creaste. Si todo es correcto, la pantalla de login desaparecerá y verás el Dashboard con tu nombre y el rol de Administrador.
