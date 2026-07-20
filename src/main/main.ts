import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';
import { Readable } from 'stream';
import sharp from 'sharp';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
const googleFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';

let drive: any = null;
let driveErrorMsg = '';

// Cache de sesión en memoria para evitar depender de persistSession de Supabase
let currentSession: { userId: string; role: string } | null = null;

const SCOPES = ['https://www.googleapis.com/auth/drive'];
let driveInitPromise: Promise<boolean> | null = null;

async function loadExistingToken(): Promise<boolean> {
  if (!googleClientId || !googleClientSecret || !googleFolderId) return false;
  const tokenPath = path.join(app.getPath('userData'), 'drive_tokens.json');
  if (!fs.existsSync(tokenPath)) return false;
  try {
    const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    const oauth2Client = new google.auth.OAuth2(googleClientId, googleClientSecret);
    oauth2Client.setCredentials(tokens);
    oauth2Client.on('tokens', (newTokens: any) => {
      try {
        const stored = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
        Object.assign(stored, newTokens);
        fs.writeFileSync(tokenPath, JSON.stringify(stored));
      } catch { /* ignore */ }
    });
    drive = google.drive({ version: 'v3', auth: oauth2Client });
    driveErrorMsg = '';
    return true;
  } catch (err: any) {
    driveErrorMsg = `Error al cargar token: ${err.message}`;
    return false;
  }
}

async function initDrive(forceReauth = false): Promise<boolean> {
  if (!googleClientId || !googleClientSecret || !googleFolderId) {
    driveErrorMsg = 'Falta GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_DRIVE_FOLDER_ID en .env';
    return false;
  }

  if (!forceReauth) {
    if (await loadExistingToken()) return true;
    if (driveInitPromise) return driveInitPromise;
  }

  const tokenPath = path.join(app.getPath('userData'), 'drive_tokens.json');

  driveInitPromise = new Promise<boolean>((resolve) => {
    let port = 0;
    let oauth2Client: any;
    let resolved = false;

    const server = http.createServer(async (req, res) => {
      if (resolved || !port) return;
      try {
        const parsedUrl = new URL(req.url!, `http://localhost:${port}`);
        const code = parsedUrl.searchParams.get('code');
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0"><h1 style="color:#166534">Autenticacion exitosa. Puedes cerrar esta ventana.</h1></body></html>');
          resolved = true;
          clearTimeout(timeout);
          server.close();

          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);
          oauth2Client.on('tokens', (newTokens: any) => {
            try {
              const stored = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
              Object.assign(stored, newTokens);
              fs.writeFileSync(tokenPath, JSON.stringify(stored));
            } catch { /* ignore */ }
          });
          fs.writeFileSync(tokenPath, JSON.stringify(tokens));
          drive = google.drive({ version: 'v3', auth: oauth2Client });
          driveErrorMsg = '';
          resolve(true);
        } else {
          const errMsg = parsedUrl.searchParams.get('error') || 'No se recibio codigo de autorizacion';
          res.writeHead(400);
          res.end(`Error: ${errMsg}`);
          resolved = true;
          clearTimeout(timeout);
          server.close();
          driveErrorMsg = errMsg;
          resolve(false);
        }
      } catch (err: any) {
        if (resolved) return;
        resolved = true;
        driveErrorMsg = `Error en autenticacion OAuth: ${err.message}`;
        if (!res.headersSent) {
          res.writeHead(500);
          res.end('Error de autenticacion.');
        }
        clearTimeout(timeout);
        server.close();
        resolve(false);
      }
    });

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      server.close();
      driveErrorMsg = 'Tiempo de espera agotado. Vuelve a intentar desde "Probar conexion".';
      resolve(false);
    }, 5 * 60 * 1000);

    server.listen(0, () => {
      port = (server.address() as any).port;
      oauth2Client = new google.auth.OAuth2(googleClientId, googleClientSecret, `http://localhost:${port}`);
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
      });
      shell.openExternal(authUrl);
    });
  });

  return driveInitPromise;
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
    if (googleClientId && googleClientSecret && googleFolderId) {
      await initDrive();
    }
    if (!drive) {
      return { success: false, error: driveErrorMsg || 'Servicio de Google Drive no configurado.' };
    }
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
    if (err.message?.includes('invalid_grant')) {
      const tokenPath = path.join(app.getPath('userData'), 'drive_tokens.json');
      try { fs.unlinkSync(tokenPath); } catch { /* ignore */ }
      drive = null;
      driveErrorMsg = 'Token expirado';
      if (googleClientId && googleClientSecret && googleFolderId) {
        await initDrive(true);
        if (drive) return { success: true, folder: { id: '', name: 'Conectado' } };
      }
    }
    return { success: false, error: err.message || 'Error de conexión con Google Drive' };
  }
});

ipcMain.handle('drive:upload-file', async (_event, { name, mimeType, base64Data }) => {
  const buffer = Buffer.from(base64Data, 'base64');
  return await uploadToDrive(buffer, mimeType, name);
});

ipcMain.handle('drive:delete-file', async (_event, { driveId }) => {
  if (!drive) return { success: false, error: driveErrorMsg || 'Google Drive no disponible.' };
  try {
    await drive.files.delete({ fileId: driveId });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar archivo de Drive' };
  }
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

ipcMain.handle('db:crear-banco', async (_event, { nombre, moneda, sedeId }) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  if (!sedeId) return { success: false, error: 'Debe seleccionar una sede.' };
  try {
    const { data, error } = await supabaseAdmin.from('bancos').insert({ nombre, moneda: moneda || 'Soles', sede_id: sedeId }).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, banco: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear banco' };
  }
});

ipcMain.handle('db:actualizar-banco', async (_event, { id, nombre, moneda, sedeId }) => {
  console.log('[DEBUG] actualizar-banco received:', { id, nombre, moneda, sedeId });
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  if (!sedeId) return { success: false, error: 'Debe seleccionar una sede.' };
  try {
    const { data, error } = await supabaseAdmin.from('bancos').update({ nombre, moneda, sede_id: sedeId }).eq('id', id).select().single();
    console.log('[DEBUG] actualizar-banco result:', { data, error });
    if (error) return { success: false, error: error.message };
    return { success: true, banco: data };
  } catch (err: any) {
    console.log('[DEBUG] actualizar-banco exception:', err);
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

// --- SERVICIOS ---
ipcMain.handle('db:listar-servicios', async () => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no configurada.' };
  try {
    const { data, error } = await supabaseAdmin
      .from('servicios')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, servicios: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al listar servicios' };
  }
});

ipcMain.handle('db:crear-servicio', async (_event, datos) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { data, error } = await supabaseAdmin
      .from('servicios')
      .insert({ nombre: datos.nombre, detrae: datos.detrae ?? false, detraccion: datos.detraccion || 0 })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, servicio: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear servicio' };
  }
});

ipcMain.handle('db:actualizar-servicio', async (_event, { id, ...datos }) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { data, error } = await supabaseAdmin
      .from('servicios')
      .update({ nombre: datos.nombre, detrae: datos.detrae ?? false, detraccion: datos.detraccion })
      .eq('id', id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, servicio: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar servicio' };
  }
});

ipcMain.handle('db:eliminar-servicio', async (_event, { id }) => {
  if (!supabaseAdmin) return { success: false, error: 'Falta SUPABASE_SERVICE_KEY en .env para esta acción.' };
  try {
    const { error } = await supabaseAdmin
      .from('servicios')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar servicio' };
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
        servicio_id: datos.servicioId || null,
        descripcion: datos.descripcion,
        monto: datos.monto,
        requiere_detraccion: datos.requiereDetraccion || false,
        archivos: datos.archivos || [],
        estado: 'PENDIENTE'
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Notificar solo a CFO sobre la nueva solicitud (ADMIN solo ve bancarizados)
    if (supabaseAdmin && data) {
      try {
        const { data: admins } = await supabaseAdmin
          .from('perfiles')
          .select('id')
          .eq('rol', 'CFO');
        if (admins && admins.length > 0) {
          const notifs = admins.map((a: any) => ({
            usuario_id: a.id,
            tipo: 'nueva_solicitud',
            mensaje: `Nueva solicitud de pago por S/ ${Number(data.monto).toFixed(2)}`,
            solicitud_id: data.id
          }));
          await supabaseAdmin.from('notificaciones').insert(notifs);
        }
      } catch { /* notificaciones no críticas */ }
    }

    return { success: true, solicitud: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al registrar solicitud' };
  }
});

ipcMain.handle('db:listar-solicitudes', async (_event, { vista, rol }) => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no disponible.' };
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, error: 'No hay sesión activa.' };

    let query = supabaseAdmin
      .from('solicitudes')
      .select('*')
      .is('deleted_at', null)
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

    // Notificar al creador de la solicitud
    if (data) {
      try {
        await supabaseAdmin.from('notificaciones').insert({
          usuario_id: data.usuario_id,
          tipo: 'rebote',
          mensaje: `Tu solicitud fue observada: ${motivo.substring(0, 80)}${motivo.length > 80 ? '...' : ''}`,
          solicitud_id: data.id
        });
      } catch { /* notificaciones no críticas */ }
    }

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

    // Notificar al creador
    if (data) {
      try {
        await supabaseAdmin.from('notificaciones').insert({
          usuario_id: data.usuario_id,
          tipo: 'bancarizado',
          mensaje: `Tu solicitud de S/ ${Number(data.monto).toFixed(2)} fue bancarizada`,
          solicitud_id: data.id
        });
      } catch { /* notificaciones no críticas */ }
    }

    return { success: true, solicitud: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al bancarizar solicitud' };
  }
});

ipcMain.handle('db:actualizar-solicitud', async (_event, { id, descripcion, proveedorId, servicioId, monto, requiereDetraccion, archivos }) => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no disponible.' };
  try {
    const updateData: any = { estado: 'PENDIENTE', observacion_motivo: null };
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (proveedorId !== undefined) updateData.proveedor_id = proveedorId;
    if (servicioId !== undefined) updateData.servicio_id = servicioId;
    if (monto !== undefined) updateData.monto = monto;
    if (requiereDetraccion !== undefined) updateData.requiere_detraccion = requiereDetraccion;
    if (archivos !== undefined) updateData.archivos = archivos;

    const { data, error } = await supabaseAdmin
      .from('solicitudes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Notificar al CFO que una solicitud observada fue reenviada
    if (supabaseAdmin && data) {
      try {
        const { data: cfos } = await supabaseAdmin
          .from('perfiles')
          .select('id')
          .eq('rol', 'CFO');
        if (cfos && cfos.length > 0) {
          const notifs = cfos.map((c: any) => ({
            usuario_id: c.id,
            tipo: 'nueva_solicitud',
            mensaje: `Solicitud observada fue reenviada por S/ ${Number(data.monto).toFixed(2)}`,
            solicitud_id: data.id
          }));
          await supabaseAdmin.from('notificaciones').insert(notifs);
        }
      } catch { /* notificaciones no críticas */ }
    }

    return { success: true, solicitud: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar solicitud' };
  }
});

ipcMain.handle('db:eliminar-solicitud', async (_event, { id }) => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no disponible.' };
  try {
    // Obtener la solicitud antes de eliminarla para saber a quién notificar
    const { data: solicitud } = await supabaseAdmin
      .from('solicitudes')
      .select('usuario_id')
      .eq('id', id)
      .single();

    const { error } = await supabaseAdmin
      .from('solicitudes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { success: false, error: error.message };

    // Notificar al creador si la solicitud estaba bancarizada
    if (solicitud) {
      try {
        await supabaseAdmin.from('notificaciones').insert({
          usuario_id: solicitud.usuario_id,
          tipo: 'eliminado',
          mensaje: 'Una de tus solicitudes bancarizadas fue eliminada',
          solicitud_id: id
        });
      } catch { /* notificaciones no críticas */ }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar solicitud' };
  }
});

ipcMain.handle('db:obtener-solicitud', async (_event, { id }) => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no disponible.' };
  try {
    const { data, error } = await supabaseAdmin
      .from('solicitudes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, solicitud: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener solicitud' };
  }
});

// --- NOTIFICACIONES ---
ipcMain.handle('db:listar-notificaciones', async (_event, { usuarioId }) => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no disponible.', notificaciones: [] };
  try {
    const { data, error } = await supabaseAdmin
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return { success: false, error: error.message, notificaciones: [] };
    return { success: true, notificaciones: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al listar notificaciones', notificaciones: [] };
  }
});

ipcMain.handle('db:marcar-notificaciones-leidas', async (_event, { usuarioId }) => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no disponible.' };
  try {
    const { error } = await supabaseAdmin
      .from('notificaciones')
      .update({ leido: true })
      .eq('usuario_id', usuarioId)
      .eq('leido', false);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al marcar notificaciones' };
  }
});

ipcMain.handle('db:eliminar-notificacion', async (_event, { id }) => {
  if (!supabaseAdmin) return { success: false, error: 'Base de datos no disponible.' };
  try {
    const { error } = await supabaseAdmin
      .from('notificaciones')
      .delete()
      .eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar notificación' };
  }
});

app.whenReady().then(() => {
  createWindow();
  loadExistingToken(); // Carga token existente si lo hay (sin abrir navegador)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
