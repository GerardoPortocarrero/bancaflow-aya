# Guía de Activación de BancaFlow: Paso a Paso (Supabase)

Sigue estos pasos para que el sistema de autenticación pase de ser una maqueta visual a un sistema real y funcional.

---

### Paso 1: Configurar la Base de Datos en la Nube
1.  Entra a tu proyecto en [Supabase](https://supabase.com/).
2.  En el menú lateral izquierdo, haz clic en **SQL Editor**.
3.  Haz clic en **New Query**.
4.  Abre el archivo `docs/setup_supabase.sql` que he creado para ti, copia todo su contenido y pégalo en el editor de Supabase.
5.  Presiona el botón **Run**. 
    *   *Resultado esperado:* Verás un mensaje de "Success". Ahora tu base de datos ya entiende de roles y perfiles.

### Paso 2: Obtener tus Llaves de Acceso (API)
1.  En Supabase, ve a **Project Settings** (el icono de engranaje abajo a la izquierda).
2.  Haz clic en la sección **API**.
3.  Busca y copia estos dos valores:
    *   **Project URL** (ej: `https://xyz.supabase.co`)
    *   **API Key (anon/public)** (una cadena larga de letras y números)

### Paso 3: Configurar BancaFlow Localmente
1.  En la carpeta raíz de este proyecto (donde está este README), crea un archivo llamado **`.env`**.
2.  Pega tus llaves con este formato exacto:
    ```env
    SUPABASE_URL=pega_aqui_tu_url
    SUPABASE_ANON_KEY=pega_aqui_tu_llave_anon
    ```

### Paso 4: Crear tu primer Usuario Administrador
1.  En Supabase, ve a **Authentication > Users**.
2.  Haz clic en **Add User > Create new user**.
3.  Escribe el correo y contraseña que quieras usar para probar.
4.  **MUY IMPORTANTE:** Una vez creado, verás una columna llamada **User UID**. Cópialo.
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
npm start
```
Ingresa el correo y contraseña que creaste. Si todo es correcto, la pantalla de login desaparecerá y verás el Dashboard con tu nombre y el rol de Administrador.
