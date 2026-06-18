// @ts-ignore
const { createIcons, LayoutDashboard, FilePlus, History, Bell, Settings, LogOut } = lucide;

// Definición de Interfaz para el API de Electron (Bridge)
interface IElectronAPI {
    auth: {
        login: (correo: string, contrasena: string) => Promise<{ success: boolean; user?: any; error?: string }>;
        logout: () => Promise<{ success: boolean; error?: string }>;
        obtenerSesion: () => Promise<{ session: any }>;
    }
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

// Verificar sesión al inicio
verificarSesion();

console.log('BancaFlow Renderer Initialized with Auth & Glassmorphism');
