// @ts-ignore
const { createIcons, LayoutDashboard, FilePlus, History, Bell, Settings, LogOut } = lucide;

// Definición de Interfaz para el API de Electron (Bridge)
interface IElectronAPI {
    auth: {
        login: (correo: string, contrasena: string) => Promise<{ success: boolean; user?: any; error?: string }>;
        logout: () => Promise<{ success: boolean; error?: string }>;
        obtenerSesion: () => Promise<{ session: any }>;
    };
    drive: {
        testConnection: () => Promise<{ success: boolean; folder?: { id: string; name: string }; error?: string }>;
        uploadFile: (name: string, mimeType: string, base64Data: string) => Promise<{ success: boolean; file?: any; error?: string }>;
        uploadOptimized: (name: string, mimeType: string, base64Data: string) => Promise<{ success: boolean; file?: any; error?: string }>;
    };
    db: {
        crearSolicitud: (datos: any) => Promise<{ success: boolean; solicitud?: any; error?: string }>;
        listarSolicitudes: () => Promise<{ success: boolean; solicitudes?: any[]; error?: string }>;
    };
}

interface Window {
    electronAPI: IElectronAPI;
}

// Inicializar iconos
function initIcons() {
    createIcons({
        icons: {
            LayoutDashboard,
            FilePlus,
            History,
            Bell,
            Settings,
            LogOut
        }
    });
}

initIcons();

// --- ELEMENTOS DEL DOM ---
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const loginBtnText = document.getElementById('login-btn-text');
const loginBtnSpinner = document.getElementById('login-btn-spinner');

// Elementos de Perfil en Sidebar (Robustos con IDs)
const userInitials = document.getElementById('user-initials');
const userName = document.getElementById('user-name');
const userRole = document.getElementById('user-role');
const logoutBtn = document.getElementById('logout-btn');

let currentUser: any = null;

// --- FUNCIONES DE AUTENTICACIÓN & NAVEGACIÓN ---

async function verificarSesion() {
    try {
        const { session } = await window.electronAPI.auth.obtenerSesion();
        if (session) {
            mostrarApp(session);
        }
    } catch (err) {
        console.error('Error al verificar sesión:', err);
    }
}

function aplicarFiltroDeRoles(rol: string) {
    const linkNuevaSolicitud = document.querySelector('[data-target="view-nueva-solicitud"]');
    if (linkNuevaSolicitud) {
        if (rol === 'CFO') {
            linkNuevaSolicitud.classList.add('hidden');
        } else {
            linkNuevaSolicitud.classList.remove('hidden');
        }
    }
}

async function verificarGoogleDrive() {
    const statusDot = document.getElementById('drive-status-dot');
    const statusText = document.getElementById('drive-status-text');
    if (!statusDot || !statusText) return;

    try {
        const resultado = await window.electronAPI.drive.testConnection();
        if (resultado.success) {
            statusDot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400';
            statusText.textContent = `Drive: Conectado (${resultado.folder?.name})`;
            statusText.className = 'text-[10px] font-bold text-emerald-400';
        } else {
            statusDot.className = 'w-1.5 h-1.5 rounded-full bg-red-400';
            statusText.textContent = 'Drive: Sin Configurar';
            statusText.className = 'text-[10px] font-bold text-red-400';
            console.warn('Google Drive no conectado:', resultado.error);
        }
    } catch (err) {
        statusDot.className = 'w-1.5 h-1.5 rounded-full bg-red-400';
        statusText.textContent = 'Drive: Error';
        statusText.className = 'text-[10px] font-bold text-red-400';
        console.error('Error al probar Google Drive:', err);
    }
}

function mostrarApp(user: any) {
    currentUser = user;
    
    if (loginScreen && appContainer) {
        loginScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        
        // Actualizar datos del usuario en la UI
        if (userName) userName.textContent = user.nombre;
        if (userRole) userRole.textContent = user.rol;
        if (userInitials) {
            const iniciales = user.nombre
                .split(' ')
                .filter((n: string) => n.length > 0)
                .map((n: string) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();
            userInitials.textContent = iniciales || 'U';
        }

        // Aplicar restricciones de rol (RF1.2)
        aplicarFiltroDeRoles(user.rol);

        // Verificar la conexión de Google Drive
        verificarGoogleDrive();
        
        // Si el rol es CFO, por defecto debe mostrar la sección de Dashboard
        const activeLink = document.querySelector('.nav-link-active') as HTMLElement;
        if (activeLink && activeLink.getAttribute('data-target') === 'view-nueva-solicitud' && user.rol === 'CFO') {
            // Simular click en Dashboard si estaba en Nueva Solicitud
            const dashboardLink = document.querySelector('[data-target="view-dashboard"]') as HTMLElement;
            if (dashboardLink) dashboardLink.click();
        }
    }
}

// Evento Submit de Login
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const correo = (document.getElementById('login-email') as HTMLInputElement).value.trim();
        const contrasena = (document.getElementById('login-password') as HTMLInputElement).value;

        // UI Loading
        if (loginBtn) loginBtn.disabled = true;
        if (loginBtnText) loginBtnText.textContent = 'Verificando...';
        if (loginBtnSpinner) loginBtnSpinner.classList.remove('hidden');
        if (loginError) loginError.classList.add('hidden');

        try {
            const resultado = await window.electronAPI.auth.login(correo, contrasena);

            if (resultado.success) {
                mostrarApp(resultado.user);
            } else {
                if (loginError) {
                    loginError.textContent = resultado.error || 'Credenciales inválidas';
                    loginError.classList.remove('hidden');
                }
                // Reset UI
                if (loginBtn) loginBtn.disabled = false;
                if (loginBtnText) loginBtnText.textContent = 'Iniciar Sesión';
                if (loginBtnSpinner) loginBtnSpinner.classList.add('hidden');
            }
        } catch (err: any) {
            if (loginError) {
                loginError.textContent = err.message || 'Error de conexión con el servicio';
                loginError.classList.remove('hidden');
            }
            if (loginBtn) loginBtn.disabled = false;
            if (loginBtnText) loginBtnText.textContent = 'Iniciar Sesión';
            if (loginBtnSpinner) loginBtnSpinner.classList.add('hidden');
        }
    });
}

// Evento Cerrar Sesión
if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const confirmacion = confirm('¿Deseas cerrar sesión en BancaFlow?');
        if (confirmacion) {
            try {
                await window.electronAPI.auth.logout();
                window.location.reload();
            } catch (err) {
                console.error('Error al cerrar sesión:', err);
                window.location.reload();
            }
        }
    });
}

// --- LÓGICA DE NAVEGACIÓN (SPA) ---
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('section[id]');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('data-target');

        // Actualizar UI de navegación
        navLinks.forEach(l => {
            l.classList.remove('nav-link-active');
            l.classList.add('nav-link-inactive');
        });
        link.classList.add('nav-link-active');
        link.classList.remove('nav-link-inactive');

        // Actualizar Título de la Vista Actual en Header
        const titleMap: any = {
            'view-dashboard': 'Dashboard General',
            'view-nueva-solicitud': 'Registrar Pago',
            'view-historial': 'Historial de Transacciones'
        };
        const titleEl = document.getElementById('current-view-title');
        if (titleEl && targetId) titleEl.textContent = titleMap[targetId] || 'BancaFlow';

        // Cambiar sección visible
        sections.forEach(section => {
            if (section.id === targetId) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });
    });
});

// --- LÓGICA DE DETRACCIONES (Regla: > 700 Soles) ---
const inputMonto = document.getElementById('input-monto') as HTMLInputElement;
const alertDetraccion = document.getElementById('alert-detraccion');

if (inputMonto && alertDetraccion) {
    inputMonto.addEventListener('input', () => {
        const monto = parseFloat(inputMonto.value);
        if (monto > 700) {
            alertDetraccion.classList.remove('hidden');
        } else {
            alertDetraccion.classList.add('hidden');
        }
    });
}

// --- LÓGICA DE ARCHIVOS (Drag & Drop) ---
let currentFile: File | null = null;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const dropzoneBrowse = document.getElementById('dropzone-browse');
const filePreview = document.getElementById('file-preview');
const filePreviewName = document.getElementById('file-preview-name');
const filePreviewSize = document.getElementById('file-preview-size');
const fileRemoveBtn = document.getElementById('file-remove-btn');

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function handleFileSelection(file: File) {
    if (!file) return;
    
    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
        alert('El archivo es demasiado grande. El máximo permitido es 25MB.');
        return;
    }

    currentFile = file;
    
    // Actualizar UI
    if (dropzone) dropzone.classList.add('hidden');
    if (filePreview) filePreview.classList.remove('hidden');
    if (filePreviewName) filePreviewName.textContent = file.name;
    if (filePreviewSize) filePreviewSize.textContent = formatBytes(file.size);
}

function clearFile() {
    currentFile = null;
    if (fileInput) fileInput.value = '';
    if (filePreview) filePreview.classList.add('hidden');
    if (dropzone) dropzone.classList.remove('hidden');
}

if (dropzone && fileInput && dropzoneBrowse) {
    // Click en la zona abre el input
    dropzoneBrowse.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('click', (e) => {
        if (e.target !== dropzoneBrowse) fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e: any) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    // Drag & Drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('fluent-dropzone-active');
    });
    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('fluent-dropzone-active');
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('fluent-dropzone-active');
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });
}

if (fileRemoveBtn) {
    fileRemoveBtn.addEventListener('click', clearFile);
}

// --- LÓGICA DE SUBMIT (Formulario) ---
const solicitudForm = document.getElementById('solicitud-form') as HTMLFormElement;
const inputProveedor = document.getElementById('input-proveedor') as HTMLInputElement;
const inputDescripcion = document.getElementById('input-descripcion') as HTMLTextAreaElement;
const btnSubmit = document.getElementById('solicitud-btn') as HTMLButtonElement;
const btnSubmitText = document.getElementById('solicitud-btn-text');
const btnSubmitSpinner = document.getElementById('solicitud-btn-spinner');

const uploadProgress = document.getElementById('upload-progress');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressText = document.getElementById('progress-text');
const submitSuccess = document.getElementById('submit-success');
const submitError = document.getElementById('submit-error');
const submitErrorText = document.getElementById('submit-error-text');

function setProgress(percent: number, text: string) {
    if (uploadProgress) uploadProgress.classList.remove('hidden');
    if (progressBarFill) progressBarFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = text;
}

function resetSubmitUI() {
    if (btnSubmit) btnSubmit.disabled = false;
    if (btnSubmitText) btnSubmitText.textContent = 'Enviar Solicitud';
    if (btnSubmitSpinner) btnSubmitSpinner.classList.add('hidden');
    if (uploadProgress) uploadProgress.classList.add('hidden');
}

if (solicitudForm) {
    solicitudForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentFile) {
            alert('Por favor, adjunte el sustento digital (PDF o imagen).');
            return;
        }

        const montoStr = inputMonto.value;
        const monto = parseFloat(montoStr);
        if (isNaN(monto) || monto <= 0) {
            alert('El monto debe ser mayor a 0.');
            return;
        }

        const requiereDetraccion = monto > 700;

        // UI Loading
        if (btnSubmit) btnSubmit.disabled = true;
        if (btnSubmitText) btnSubmitText.textContent = 'Procesando...';
        if (btnSubmitSpinner) btnSubmitSpinner.classList.remove('hidden');
        if (submitSuccess) submitSuccess.classList.add('hidden');
        if (submitError) submitError.classList.add('hidden');

        try {
            setProgress(10, 'Preparando archivo...');

            // 1. Leer archivo y convertir a Base64
            const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(currentFile!);
                reader.onload = () => {
                    const result = reader.result as string;
                    // Remover "data:image/png;base64,"
                    const b64 = result.split(',')[1];
                    resolve(b64);
                };
                reader.onerror = error => reject(error);
            });

            setProgress(40, 'Comprimiendo y subiendo a Google Drive...');

            // 2. Subir a Drive usando la función optimizada
            const driveRes = await window.electronAPI.drive.uploadOptimized(
                currentFile.name,
                currentFile.type,
                base64Data
            );

            if (!driveRes.success) {
                throw new Error(driveRes.error || 'Error al subir a Drive');
            }

            setProgress(80, 'Registrando en Base de Datos...');

            // 3. Guardar en Supabase
            const dbRes = await window.electronAPI.db.crearSolicitud({
                proveedor: inputProveedor.value.trim(),
                descripcion: inputDescripcion.value.trim(),
                monto: monto,
                requiereDetraccion: requiereDetraccion,
                archivoNombre: driveRes.file.name,
                archivoDriveId: driveRes.file.id,
                archivoDriveUrl: driveRes.file.webViewLink
            });

            if (!dbRes.success) {
                throw new Error(dbRes.error || 'Error al guardar en Supabase');
            }

            setProgress(100, '¡Completado!');

            // 4. Éxito
            resetSubmitUI();
            if (submitSuccess) submitSuccess.classList.remove('hidden');
            
            // Limpiar formulario después de éxito
            solicitudForm.reset();
            clearFile();
            if (alertDetraccion) alertDetraccion.classList.add('hidden');

            setTimeout(() => {
                if (submitSuccess) submitSuccess.classList.add('hidden');
                // Opcional: Redirigir a Historial
                const historialLink = document.querySelector('[data-target="view-historial"]') as HTMLElement;
                if (historialLink) historialLink.click();
            }, 3000);

        } catch (err: any) {
            console.error('Submit Error:', err);
            resetSubmitUI();
            if (submitErrorText) submitErrorText.textContent = err.message || 'Ocurrió un error inesperado.';
            if (submitError) submitError.classList.remove('hidden');
        }
    });
}

// Verificar sesión al inicio
verificarSesion();

console.log('BancaFlow Renderer Initialized with File Pipeline');

