import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';
import { Readable } from 'stream';
import sharp from 'sharp';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const googleEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
const googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY || '';
const googleFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';

let drive: any = null;
let driveErrorMsg = '';

// Cache de sesión en memoria para evitar depender de persistSession de Supabase
let currentSession: { userId: string; role: string } | null = null;

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
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: 'rgba(0, 0, 0, 0)',
      symbolColor: '#ffffff',
      height: 40
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

async function uploadToDrive(buffer: Buffer, mimeType: string, fileName: string): Promise<{ success: boolean; file?: any; error?: string }> {
  if (!drive) {
    return { success: false, error: driveErrorMsg || 'Servicio de Google Drive no configurado.' };
  }
  try {
    let finalBuffer = buffer;
    let finalMimeType = mimeType;
    let finalName = fileName;

    if (mimeType.startsWith('image/')) {
      finalBuffer = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 60 })
        .toBuffer();
      finalMimeType = 'image/webp';
      finalName = fileName.replace(/\.[^.]+$/, '.webp');
    }

    const media = {
      mimeType: finalMimeType,
      body: Readable.from(finalBuffer),
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
    return { success: false, error: err.message || 'Error al subir archivo a Google Drive' };
  }
}

async function getCurrentUserRole(): Promise<string | null> {
  if (currentSession) return currentSession.role;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', sessionData.session.user.id)
    .single();
  return perfil ? perfil.rol : null;
}

async function getCurrentUserId(): Promise<string | null> {
  if (currentSession) return currentSession.userId;
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.user?.id || null;
}

// --- AUTH ---

ipcMain.handle('auth:login', async (_event, { correo, contrasena }) => {
  if (!supabase) {
    return { success: false, error: supabaseErrorMsg || 'Servicio de base de datos no configurado localmente.' };
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    });
    if (error) return { success: false, error: error.message };

    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles')
      .select('rol, nombre, apellido')
      .eq('id', data.user?.id)
      .single();

    const userId = data.user?.id || '';
    const userRole = perfilError ? 'RRHH' : perfil.rol;

    // Cachear sesión en memoria
    currentSession = { userId, role: userRole };

    if (perfilError) {
      return {
        success: true,
        user: { id: userId, email: data.user?.email, nombre: 'Usuario', rol: userRole }
      };
    }

    return {
      success: true,
      user: {
        id: userId,
        email: data.user?.email,
        nombre: `${perfil.nombre} ${perfil.apellido}`,
        rol: userRole
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error interno de autenticación' };
  }
});

ipcMain.handle('auth:logout', async () => {
  currentSession = null;
  if (!supabase) return { success: true };
  const { error } = await supabase.auth.signOut();
  return { success: !error, error: error?.message };
});

ipcMain.handle('auth:get-session', async () => {
  if (!supabase) return { session: null };
  // Usar cache primero
  if (currentSession) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol, nombre, apellido')
      .eq('id', currentSession.userId)
      .single();
    if (!perfil) return { session: null };
    return { session: { id: currentSession.userId, email: '', nombre: `${perfil.nombre} ${perfil.apellido}`, rol: perfil.rol } };
  }
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

ipcMain.handle('auth:listar-usuarios', async () => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError) return { success: false, error: usersError.message };

    const { data: perfilesData, error: perfilesError } = await supabaseAdmin.from('perfiles').select('*');
    if (perfilesError) return { success: false, error: perfilesError.message };

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

ipcMain.handle('auth:actualizar-usuario', async (_event, { id, nombre, apellido, rol }) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { error: perfilError } = await supabaseAdmin.from('perfiles').update({ nombre, apellido, rol }).eq('id', id);
    if (perfilError) return { success: false, error: perfilError.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar usuario' };
  }
});

ipcMain.handle('auth:eliminar-usuario', async (_event, { id }) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { error: perfilError } = await supabaseAdmin.from('perfiles').delete().eq('id', id);
    if (perfilError) return { success: false, error: perfilError.message };
    const { error: userError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (userError) return { success: false, error: userError.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar usuario' };
  }
});

// --- DRIVE ---

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
      folder: { id: response.data.id, name: response.data.name }
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error de conexión con Google Drive' };
  }
});

ipcMain.handle('drive:upload-file', async (_event, { name, mimeType, base64Data }) => {
  const buffer = Buffer.from(base64Data, 'base64');
  return await uploadToDrive(buffer, mimeType, name);
});

// --- BANCOS ---

ipcMain.handle('db:listar-bancos', async () => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no configurada.' };
  try {
    const { data, error } = await supabaseAdmin.from('bancos').select('*').order('nombre', { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, bancos: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al listar bancos' };
  }
});

ipcMain.handle('db:crear-banco', async (_event, { nombre, moneda }) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { data, error } = await supabaseAdmin.from('bancos').insert({ nombre, moneda: moneda || 'Soles' }).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, banco: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear banco' };
  }
});

ipcMain.handle('db:actualizar-banco', async (_event, { id, nombre, moneda }) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { data, error } = await supabaseAdmin.from('bancos').update({ nombre, moneda }).eq('id', id).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, banco: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar banco' };
  }
});

ipcMain.handle('db:eliminar-banco', async (_event, { id }) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { error } = await supabaseAdmin.from('bancos').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar banco' };
  }
});

// --- SEDES ---

ipcMain.handle('db:listar-sedes', async () => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no configurada.' };
  try {
    const { data, error } = await supabaseAdmin.from('sedes').select('*').order('nombre', { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, sedes: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al listar sedes' };
  }
});

ipcMain.handle('db:crear-sede', async (_event, { nombre }) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { data, error } = await supabaseAdmin.from('sedes').insert({ nombre }).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, sede: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear sede' };
  }
});

ipcMain.handle('db:actualizar-sede', async (_event, { id, nombre }) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { data, error } = await supabaseAdmin.from('sedes').update({ nombre }).eq('id', id).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, sede: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar sede' };
  }
});

ipcMain.handle('db:eliminar-sede', async (_event, { id }) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { error } = await supabaseAdmin.from('sedes').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar sede' };
  }
});

// --- PROVEEDORES ---

ipcMain.handle('db:listar-proveedores', async () => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no configurada.' };
  try {
    const { data, error } = await supabaseAdmin
      .from('proveedores')
      .select('*')
      .order('nombre_razon_social', { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, proveedores: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al listar proveedores' };
  }
});

ipcMain.handle('db:crear-proveedor', async (_event, datos) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { data, error } = await supabaseAdmin
      .from('proveedores')
      .insert({
        nombre_razon_social: datos.nombre_razon_social,
        correo: datos.correo || null,
        banco_id: datos.banco_id || null,
        numero_cuenta: datos.numero_cuenta || null,
        sede_id: datos.sede_id || null,
        cci: datos.cci || null,
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, proveedor: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear proveedor' };
  }
});

ipcMain.handle('db:actualizar-proveedor', async (_event, { id, ...datos }) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { data, error } = await supabaseAdmin.from('proveedores').update(datos).eq('id', id).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, proveedor: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar proveedor' };
  }
});

ipcMain.handle('db:eliminar-proveedor', async (_event, { id }) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { error } = await supabaseAdmin.from('proveedores').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar proveedor' };
  }
});

ipcMain.handle('db:listar-perfiles', async () => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no configurada.' };
  try {
    const { data, error } = await supabaseAdmin.from('perfiles').select('id, nombre, apellido, rol');
    if (error) return { success: false, error: error.message };
    return { success: true, perfiles: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al listar perfiles' };
  }
});

// --- SOLICITUDES ---

ipcMain.handle('db:crear-solicitud', async (_event, datos) => {
  if (!supabase) return { success: false, error: supabaseErrorMsg || 'Base de datos no configurada.' };
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, error: 'No hay sesión activa. Inicie sesión nuevamente.' };

    const { data, error } = await supabase
      .from('solicitudes')
      .insert({
        usuario_id: userId,
        proveedor_id: datos.proveedorId,
        descripcion: datos.descripcion,
        monto: datos.monto,
        requiere_detraccion: datos.requiereDetraccion || false,
        archivos: datos.archivos || [],
        estado: 'PENDIENTE'
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, solicitud: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al registrar solicitud' };
  }
});

ipcMain.handle('db:listar-solicitudes', async (_event, { vista, rol }) => {
  if (!supabase) return { success: false, error: supabaseErrorMsg || 'Base de datos no configurada.' };
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, error: 'No hay sesión activa.' };

    let query = supabase
      .from('solicitudes')
      .select('*')
      .order('created_at', { ascending: false });

    if (vista === 'cfo-bandeja') {
      query = query.in('estado', ['PENDIENTE']);
    } else if (vista === 'bancarizados') {
      query = query.eq('estado', 'BANCARIZADO');
      if (rol !== 'CFO') {
        query = query.eq('usuario_id', userId);
      }
    } else if (vista === 'mis-solicitudes') {
      query = query.in('estado', ['PENDIENTE', 'OBSERVADO']).eq('usuario_id', userId);
    } else if (vista === 'mis-bancarizados') {
      query = query.eq('estado', 'BANCARIZADO').eq('usuario_id', userId);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, solicitudes: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener solicitudes' };
  }
});

ipcMain.handle('db:observar-solicitud', async (_event, { id, motivo }) => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no disponible.' };
  try {
    const { data, error } = await supabaseAdmin
      .from('solicitudes')
      .update({ estado: 'OBSERVADO', observacion_motivo: motivo })
      .eq('id', id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, solicitud: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al observar solicitud' };
  }
});

ipcMain.handle('db:bancarizar-solicitud', async (_event, { id, evidencias }) => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no disponible.' };
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabaseAdmin
      .from('solicitudes')
      .update({
        estado: 'BANCARIZADO',
        evidencias_bancarizacion: evidencias,
        bancarizado_por: userId
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, solicitud: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al bancarizar solicitud' };
  }
});

ipcMain.handle('db:actualizar-solicitud', async (_event, { id, descripcion, proveedorId, monto, archivos }) => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no disponible.' };
  try {
    const updateData: any = { estado: 'PENDIENTE', observacion_motivo: null };
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (proveedorId !== undefined) updateData.proveedor_id = proveedorId;
    if (monto !== undefined) updateData.monto = monto;
    if (archivos !== undefined) updateData.archivos = archivos;

    const { data, error } = await supabaseAdmin
      .from('solicitudes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, solicitud: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar solicitud' };
  }
});

ipcMain.handle('db:eliminar-solicitud', async (_event, { id }) => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no disponible.' };
  try {
    const { error } = await supabaseAdmin
      .from('solicitudes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar solicitud' };
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
