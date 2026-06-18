import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Inicializar Supabase en Capa Segura con resiliencia (Evita crasheo si no está configurado)
let supabase: any = null;
let supabaseErrorMsg = '';

if (!supabaseUrl || !supabaseAnonKey) {
  supabaseErrorMsg = 'Servicio no configurado. Falta SUPABASE_URL o SUPABASE_ANON_KEY en el archivo .env';
  console.warn(`⚠️ Alerta BancaFlow: ${supabaseErrorMsg}`);
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });
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
          rol: 'SOLICITANTE'
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
      rol: perfil ? perfil.rol : 'SOLICITANTE'
    }
  };
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
