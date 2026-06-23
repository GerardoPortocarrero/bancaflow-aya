import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';
import { Readable } from 'stream';
import sharp from 'sharp';

// Cargar variables de entorno
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const googleEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
const googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY || '';
const googleFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';

// Inicializar Google Drive API con resiliencia
let drive: any = null;
let driveErrorMsg = '';

if (!googleEmail || !googlePrivateKey || !googleFolderId) {
  driveErrorMsg = 'Servicio de Google Drive no configurado. Falta GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY o GOOGLE_DRIVE_FOLDER_ID en el archivo .env';
  console.warn(`⚠️ Alerta BancaFlow: ${driveErrorMsg}`);
} else {
  try {
    const formattedKey = googlePrivateKey.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email: googleEmail,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    drive = google.drive({ version: 'v3', auth });
  } catch (err: any) {
    driveErrorMsg = `Error al inicializar Google Drive API: ${err.message}`;
    console.error(err);
  }
}

// Inicializar Supabase en Capa Segura con resiliencia
let supabase: any = null;
let supabaseAdmin: any = null;
let supabaseErrorMsg = '';

if (!supabaseUrl || !supabaseAnonKey) {
  supabaseErrorMsg = 'Servicio no configurado. Falta SUPABASE_URL o SUPABASE_ANON_KEY en el archivo .env';
  console.warn(`⚠️ Alerta BancaFlow: ${supabaseErrorMsg}`);
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });
    if (supabaseServiceKey) {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
    }
  } catch (err: any) {
    supabaseErrorMsg = `Error al inicializar Supabase: ${err.message}`;
    console.error(err);
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hidden', // Estilo Fluent para barra de título
    titleBarOverlay: {
      color: 'rgba(0, 0, 0, 0)', // Totalmente transparente
      symbolColor: '#ffffff', // Controles blancos para alto contraste sobre cristal oscuro
      height: 40 // Altura estándar para botones de Windows 11
    },
    transparent: true,
    vibrancy: 'sidebar',
    backgroundMaterial: 'acrylic',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

// Configurar los manejadores IPC para la autenticación segura (Fase 2)
ipcMain.handle('auth:login', async (_event, { correo, contrasena }) => {
  if (!supabase) {
    return { success: false, error: supabaseErrorMsg || 'Servicio de base de datos no configurado localmente.' };
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Buscar el perfil en la tabla relacional
    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles')
      .select('rol, nombre, apellido')
      .eq('id', data.user?.id)
      .single();

    if (perfilError) {
      return {
        success: true,
        user: {
          id: data.user?.id,
          email: data.user?.email,
          nombre: 'Usuario',
          rol: 'RRHH'
        }
      };
    }

    return {
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        nombre: `${perfil.nombre} ${perfil.apellido}`,
        rol: perfil.rol
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error interno de autenticación' };
  }
});

ipcMain.handle('auth:logout', async () => {
  if (!supabase) return { success: true };
  const { error } = await supabase.auth.signOut();
  return { success: !error, error: error?.message };
});

ipcMain.handle('auth:get-session', async () => {
  if (!supabase) return { session: null };
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { session: null };

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol, nombre, apellido')
    .eq('id', data.session.user?.id)
    .single();

  return {
    session: {
      id: data.session.user?.id,
      email: data.session.user?.email,
      nombre: perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Usuario',
      rol: perfil ? perfil.rol : 'RRHH'
    }
  };
});

// Manejadores IPC para Google Drive Bridge
ipcMain.handle('drive:test-connection', async () => {
  if (!drive) {
    return { success: false, error: driveErrorMsg || 'Servicio de Google Drive no configurado.' };
  }
  try {
    const response = await drive.files.get({
      fileId: googleFolderId,
      fields: 'id, name, mimeType',
    });
    return {
      success: true,
      folder: {
        id: response.data.id,
        name: response.data.name,
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error de conexión con Google Drive' };
  }
});

ipcMain.handle('drive:upload', async (_event, { name, mimeType, base64Data }) => {
  if (!drive) {
    return { success: false, error: driveErrorMsg || 'Servicio de Google Drive no configurado.' };
  }
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const media = {
      mimeType: mimeType,
      body: Readable.from(buffer),
    };
    const fileMetadata = {
      name: name,
      parents: [googleFolderId],
    };
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
    });
    return {
      success: true,
      file: {
        id: response.data.id,
        name: response.data.name,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al subir archivo a Google Drive' };
  }
});

// Handler optimizado: Comprime imagen con Sharp antes de subir a Drive
ipcMain.handle('drive:upload-optimized', async (_event, { name, mimeType, base64Data }) => {
  if (!drive) {
    return { success: false, error: driveErrorMsg || 'Servicio de Google Drive no configurado.' };
  }
  try {
    let buffer: any = Buffer.from(base64Data, 'base64');
    let finalMimeType = mimeType;
    let finalName = name;

    // Si es imagen, comprimir con Sharp a WebP
    if (mimeType.startsWith('image/')) {
      buffer = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 60 })
        .toBuffer();
      finalMimeType = 'image/webp';
      // Cambiar extensión del nombre a .webp
      finalName = name.replace(/\.[^.]+$/, '.webp');
      console.log(`📦 Compresión: ${(base64Data.length * 0.75 / 1024).toFixed(1)}KB → ${(buffer.length / 1024).toFixed(1)}KB`);
    }
    // PDFs se suben sin modificar por ahora (pdf-lib para fase futura)

    const media = {
      mimeType: finalMimeType,
      body: Readable.from(buffer),
    };
    const fileMetadata = {
      name: finalName,
      parents: [googleFolderId],
    };
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
    });
    return {
      success: true,
      file: {
        id: response.data.id,
        name: response.data.name,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al procesar y subir archivo' };
  }
});

// Manejadores IPC para Proveedores y Usuarios
ipcMain.handle('db:crear-proveedor', async (_event, datos) => {
  if (!supabase) return { success: false, error: supabaseErrorMsg || 'Base de datos no configurada.' };
  try {
    const { data, error } = await supabase
      .from('proveedores')
      .insert(datos)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, proveedor: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear proveedor' };
  }
});

ipcMain.handle('db:listar-proveedores', async () => {
  if (!supabase) return { success: false, error: supabaseErrorMsg || 'Base de datos no configurada.' };
  try {
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre_razon_social', { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, proveedores: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al listar proveedores' };
  }
});

ipcMain.handle('auth:listar-usuarios', async () => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError) return { success: false, error: usersError.message };

    const { data: perfilesData, error: perfilesError } = await supabaseAdmin.from('perfiles').select('*');
    if (perfilesError) return { success: false, error: perfilesError.message };

    // Unir datos de auth con perfiles
    const usuarios = usersData.users.map((u: any) => {
      const perfil = perfilesData.find((p: any) => p.id === u.id);
      return {
        id: u.id,
        email: u.email,
        nombre: perfil ? perfil.nombre : '',
        apellido: perfil ? perfil.apellido : '',
        rol: perfil ? perfil.rol : 'RRHH',
        created_at: u.created_at
      };
    });

    return { success: true, usuarios };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al listar usuarios' };
  }
});

ipcMain.handle('auth:crear-usuario', async (_event, datos) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: datos.correo,
      password: datos.contrasena,
      email_confirm: true
    });
    if (error) return { success: false, error: error.message };

    // Insertar en la tabla de perfiles (Admin lo puede hacer directamente)
    const { error: perfilError } = await supabaseAdmin.from('perfiles').insert({
      id: data.user.id,
      nombre: datos.nombre,
      apellido: datos.apellido,
      rol: datos.rol
    });

    if (perfilError) return { success: false, error: perfilError.message };

    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear usuario' };
  }
});

// Manejadores IPC para Base de Datos (Solicitudes)
ipcMain.handle('db:crear-solicitud', async (_event, datos) => {
  if (!supabase) {
    return { success: false, error: supabaseErrorMsg || 'Base de datos no configurada.' };
  }
  try {
    // Obtener sesión activa para el usuario_id
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return { success: false, error: 'No hay sesión activa. Inicie sesión nuevamente.' };
    }
    const userId = sessionData.session.user.id;

    const { data, error } = await supabase
      .from('solicitudes')
      .insert({
        usuario_id: userId,
        proveedor_id: datos.proveedorId,
        descripcion: datos.descripcion,
        monto: datos.monto,
        requiere_detraccion: datos.requiereDetraccion,
        archivo_nombre: datos.archivoNombre,
        archivo_drive_id: datos.archivoDriveId,
        archivo_drive_url: datos.archivoDriveUrl,
        estado: 'PENDIENTE'
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, solicitud: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al registrar solicitud' };
  }
});

ipcMain.handle('db:listar-solicitudes', async (_event, filtro) => {
  if (!supabase) {
    return { success: false, error: supabaseErrorMsg || 'Base de datos no configurada.' };
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return { success: false, error: 'No hay sesión activa.' };
    }
    const userId = sessionData.session.user.id;

    // Verificar rol del usuario
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', userId)
      .single();

    let query = supabase
      .from('solicitudes')
      .select(`
        *,
        perfiles:usuario_id (nombre, apellido),
        proveedores:proveedor_id (nombre_razon_social)
      `)
      .order('created_at', { ascending: false });

    // Lógica de Filtros (Bandeja vs Historial)
    // - actives: PENDIENTE, OBSERVADO
    // - history: APROBADO, BANCARIZADO, RECHAZADO
    if (filtro === 'activas') {
      query = query.in('estado', ['PENDIENTE', 'OBSERVADO']);
    } else if (filtro === 'historial') {
      query = query.in('estado', ['APROBADO', 'BANCARIZADO', 'RECHAZADO']);
    }

    // Si NO es CFO ni ADMINISTRADOR, filtrar solo sus propias solicitudes
    if (!perfil || (perfil.rol !== 'CFO' && perfil.rol !== 'ADMINISTRADOR')) {
      query = query.eq('usuario_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, solicitudes: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener solicitudes' };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});