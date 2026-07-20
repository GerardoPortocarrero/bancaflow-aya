declare const lucide: any;
const { createIcons, LayoutDashboard, FilePlus, History: HistoryIcon, Bell, Settings, LogOut, Inbox, Users, Shield, Landmark, Building, Briefcase, CircleCheck, Pencil, Trash2, XCircle, Banknote, Eye } = lucide;

interface ArchivoSubido {
  name: string;
  driveId: string;
  driveUrl: string;
}

interface IElectronAPI {
  auth: {
    login: (correo: string, contrasena: string) => Promise<{ success: boolean; user?: any; error?: string }>;
    logout: () => Promise<{ success: boolean; error?: string }>;
    obtenerSesion: () => Promise<{ session: any }>;
    crearUsuario: (datos: any) => Promise<{ success: boolean; user?: any; error?: string }>;
    listarUsuarios: () => Promise<{ success: boolean; usuarios?: any[]; error?: string }>;
    actualizarUsuario: (id: string, nombre: string, apellido: string, rol: string) => Promise<{ success: boolean; error?: string }>;
    eliminarUsuario: (id: string) => Promise<{ success: boolean; error?: string }>;
  };
  drive: {
    testConnection: () => Promise<{ success: boolean; folder?: { id: string; name: string }; error?: string }>;
    uploadFile: (name: string, mimeType: string, base64Data: string) => Promise<{ success: boolean; file?: any; error?: string }>;
    deleteFile: (driveId: string) => Promise<{ success: boolean; error?: string }>;
  };
  db: {
    listarBancos: () => Promise<{ success: boolean; bancos?: any[]; error?: string }>;
    crearBanco: (nombre: string, moneda: string, sedeId: string) => Promise<{ success: boolean; banco?: any; error?: string }>;
    listarSedes: () => Promise<{ success: boolean; sedes?: any[]; error?: string }>;
    crearSede: (nombre: string) => Promise<{ success: boolean; sede?: any; error?: string }>;
    listarProveedores: () => Promise<{ success: boolean; proveedores?: any[]; error?: string }>;
    listarServicios: () => Promise<{ success: boolean; servicios?: any[]; error?: string }>;
    crearServicio: (datos: any) => Promise<{ success: boolean; servicio?: any; error?: string }>;
    actualizarServicio: (id: string, datos: any) => Promise<{ success: boolean; servicio?: any; error?: string }>;
    eliminarServicio: (id: string) => Promise<{ success: boolean; error?: string }>;
    crearProveedor: (datos: any) => Promise<{ success: boolean; proveedor?: any; error?: string }>;
    crearSolicitud: (datos: any) => Promise<{ success: boolean; solicitud?: any; error?: string }>;
    listarSolicitudes: (vista: string, rol: string) => Promise<{ success: boolean; solicitudes?: any[]; error?: string }>;
    observarSolicitud: (id: string, motivo: string) => Promise<{ success: boolean; solicitud?: any; error?: string }>;
    bancarizarSolicitud: (id: string, evidencias: any[]) => Promise<{ success: boolean; solicitud?: any; error?: string }>;
    actualizarSolicitud: (datos: any) => Promise<{ success: boolean; solicitud?: any; error?: string }>;
    eliminarSolicitud: (id: string) => Promise<{ success: boolean; error?: string }>;
    obtenerSolicitud: (id: string) => Promise<{ success: boolean; solicitud?: any; error?: string }>;
    actualizarBanco: (id: string, nombre: string, moneda: string, sedeId: string) => Promise<{ success: boolean; banco?: any; error?: string }>;
    eliminarBanco: (id: string) => Promise<{ success: boolean; error?: string }>;
    actualizarSede: (id: string, nombre: string) => Promise<{ success: boolean; sede?: any; error?: string }>;
    eliminarSede: (id: string) => Promise<{ success: boolean; error?: string }>;
    actualizarProveedor: (id: string, datos: any) => Promise<{ success: boolean; proveedor?: any; error?: string }>;
    eliminarProveedor: (id: string) => Promise<{ success: boolean; error?: string }>;
    listarPerfiles: () => Promise<{ success: boolean; perfiles?: any[]; error?: string }>;
    actualizarUsuario: (id: string, nombre: string, apellido: string, rol: string) => Promise<{ success: boolean; error?: string }>;
    eliminarUsuario: (id: string) => Promise<{ success: boolean; error?: string }>;
    listarNotificaciones: (usuarioId: string) => Promise<{ success: boolean; notificaciones?: any[]; error?: string }>;
    marcarNotificacionesLeidas: (usuarioId: string) => Promise<{ success: boolean; error?: string }>;
    eliminarNotificacion: (id: string) => Promise<{ success: boolean; error?: string }>;
  };
}

interface Window { electronAPI: IElectronAPI; }

function initIcons() {
  createIcons({
    icons: { LayoutDashboard, FilePlus, History: HistoryIcon, Bell, Settings, LogOut, Inbox, Users, Shield, Landmark, Building, Briefcase, CircleCheck }
  });
}
initIcons();

// --- STATE ---
let currentUser: any = null;
let editingSolicitudId: string | null = null;
let solicitudFiles: File[] = [];
let bancarizarFiles: File[] = [];
let proveedorMap = new Map<string, any>();
let servicioMap = new Map<string, any>();
let perfilMap = new Map<string, any>();
let notificaciones: any[] = [];
let notifDropdownAbierto = false;
let archivosExistentes: ArchivoSubido[] = [];
let archivosAEliminar: string[] = [];

// --- DOM REFS ---
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const loginBtnText = document.getElementById('login-btn-text');
const loginBtnSpinner = document.getElementById('login-btn-spinner');

const userInitials = document.getElementById('user-initials');
const userName = document.getElementById('user-name');
const userRole = document.getElementById('user-role');
const logoutBtn = document.getElementById('logout-btn');

// --- AUTH ---
async function verificarSesion() {
  try {
    const { session } = await window.electronAPI.auth.obtenerSesion();
    if (session) mostrarApp(session);
  } catch (err) { console.error(err); }
}

function aplicarFiltroDeRoles(rol: string) {
  const navItems = [
    'nav-mis-solicitudes', 'nav-cfo-bandeja', 'nav-bancarizados',
    'nav-proveedores', 'nav-bancos', 'nav-servicios', 'nav-sedes', 'nav-usuarios'
  ];
  navItems.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  if (rol === 'CFO') {
    setVis('nav-cfo-bandeja', true);
    setVis('nav-bancarizados', true);
    setVis('nav-proveedores', true);
    setVis('nav-bancos', true);
    setVis('nav-servicios', true);
  } else if (rol === 'ADMINISTRADOR') {
    setVis('nav-mis-solicitudes', true);
    setVis('nav-bancarizados', true);
    setVis('nav-proveedores', true);
    setVis('nav-bancos', true);
    setVis('nav-servicios', true);
    setVis('nav-sedes', true);
    setVis('nav-usuarios', true);
  } else if (rol === 'CONTADOR') {
    setVis('nav-mis-solicitudes', true);
    setVis('nav-bancarizados', true);
    setVis('nav-bancos', true);
    setVis('nav-servicios', true);
  } else {
    setVis('nav-mis-solicitudes', true);
    setVis('nav-bancarizados', true);
  }
}

function setVis(id: string, show: boolean) {
  const el = document.getElementById(id);
  if (!el) return;
  if (show) el.classList.remove('hidden'); else el.classList.add('hidden');
}

async function verificarGoogleDrive() {
  const statusEl = document.getElementById('drive-status');
  const statusDot = document.getElementById('drive-status-dot');
  const statusText = document.getElementById('drive-status-text');
  if (!statusDot || !statusText) return;
  const setStatus = (dotClass: string, text: string, textClass: string) => {
    statusDot.className = dotClass;
    statusText.textContent = text;
    statusText.className = textClass;
  };
  setStatus('w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse', 'Verificando Drive...', 'text-[10px] font-bold text-amber-400');
  try {
    const resultado = await window.electronAPI.drive.testConnection();
    if (resultado.success) {
      setStatus('w-1.5 h-1.5 rounded-full bg-emerald-400', `Drive: Conectado (${resultado.folder?.name})`, 'text-[10px] font-bold text-emerald-400');
    } else {
      setStatus('w-1.5 h-1.5 rounded-full bg-red-400', `Drive: ${resultado.error || 'Sin Configurar'}`, 'text-[10px] font-bold text-red-400');
    }
  } catch (err: any) {
    setStatus('w-1.5 h-1.5 rounded-full bg-red-400', `Drive: Error (${err.message || 'desconocido'})`, 'text-[10px] font-bold text-red-400');
  }
}

// Al hacer clic en el status de Drive, reintenta la conexión
const driveStatusBtn = document.getElementById('drive-status');
if (driveStatusBtn) {
  driveStatusBtn.addEventListener('click', verificarGoogleDrive);
}

// --- TOAST NOTIFICATIONS ---
function toast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons: any = { success: 'circle-check', error: 'alert-circle', info: 'info' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<i data-lucide="${icons[type]}" class="w-4 h-4 shrink-0"></i><span>${message}</span>`;
  container.appendChild(el);
  createIcons({ icons: { [icons[type]]: lucide[icons[type]] }, attrs: { width: '16', height: '16' } });
  setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 300); }, duration);
}

function confirmDialog(message: string, confirmText = 'Eliminar', danger = true): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-overlay');
    if (!overlay) { resolve(confirm(message)); return; }
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <h3>${confirmText === 'Eliminar' ? 'Confirmar eliminación' : 'Confirmar'}</h3>
        <p>${message}</p>
        <div class="buttons">
          <button class="btn-cancel" id="confirm-cancel">Cancelar</button>
          <button class="${danger ? 'btn-danger' : 'px-4 py-2 text-sm font-bold bg-fluent-accent text-slate-950 rounded-lg hover:bg-[#80d8ff]'}" id="confirm-ok">${confirmText}</button>
        </div>
      </div>`;
    overlay.classList.remove('hidden');
    overlay.querySelector('#confirm-cancel')?.addEventListener('click', () => { overlay.classList.add('hidden'); resolve(false); });
    overlay.querySelector('#confirm-ok')?.addEventListener('click', () => { overlay.classList.add('hidden'); resolve(true); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.classList.add('hidden'); resolve(false); } });
  });
}

// --- MODAL HELPERS ---
function setupModalBackdrop() {
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === el) {
        const modalId = el.id;
        closeModal(modalId);
      }
    });
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach((el: any) => closeModal(el.id));
  }
});

function openModal(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  const firstInput = el.querySelector('input:not([type="file"]):not([type="hidden"]), textarea, select') as HTMLElement;
  setTimeout(() => firstInput?.focus(), 100);
}

function closeModal(id: string) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
  const confirmOverlay = document.getElementById('confirm-overlay');
  if (confirmOverlay) confirmOverlay.classList.add('hidden');
}

async function mostrarApp(user: any) {
  currentUser = user;
  if (!loginScreen || !appContainer) return;
  loginScreen.classList.add('hidden');
  appContainer.classList.remove('hidden');

  if (userName) userName.textContent = user.nombre || user.email;
  if (userRole) userRole.textContent = user.rol;
  if (userInitials) {
    const iniciales = (user.nombre || user.email || 'U')
      .split(' ').filter((n: string) => n.length > 0).map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
    userInitials.textContent = iniciales || 'U';
  }

  aplicarFiltroDeRoles(user.rol);
  verificarGoogleDrive();
  await cargarDatosIniciales();

  const activeLink = document.querySelector('.nav-link-active') as HTMLElement;
  if (activeLink && activeLink.getAttribute('data-target') === 'view-mis-solicitudes' && user.rol === 'CFO') {
    const dashboardLink = document.querySelector('[data-target="view-dashboard"]') as HTMLElement;
    if (dashboardLink) dashboardLink.click();
  }

  iniciarAutoRefresh();
}

// --- AUTO-REFRESH cada 10 segundos ---
let autoRefreshTimer: any = null;

function iniciarAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(async () => {
    const activeLink = document.querySelector('.nav-link-active');
    const targetId = activeLink?.getAttribute('data-target');
    if (!targetId || !currentUser) return;

    try {
      if (targetId === 'view-cfo-bandeja' && currentUser.rol === 'CFO') {
        await cargarBandejaCFO();
      } else if (targetId === 'view-mis-solicitudes') {
        await cargarMisSolicitudes();
      } else if (targetId === 'view-bancarizados') {
        await cargarBancarizados();
      } else if (targetId === 'view-dashboard') {
        await cargarDashboard();
      }
      await cargarNotificaciones();
    } catch { /* silencioso */ }
  }, 10000);
}

// --- NOTIFICACIONES ---
async function cargarNotificaciones() {
  if (!currentUser?.id) return;
  try {
    const res = await window.electronAPI.db.listarNotificaciones(currentUser.id);
    if (res.success && res.notificaciones) {
      notificaciones = res.notificaciones;
    }
  } catch { /* silencioso */ }
  actualizarBadgeNotif();
}

function actualizarBadgeNotif() {
  const badge = document.getElementById('notif-badge');
  const btn = document.getElementById('btn-notificaciones');
  if (!badge) return;
  const noLeidas = notificaciones.filter(n => !n.leido).length;
  badge.textContent = noLeidas > 99 ? '99+' : String(noLeidas);
  badge.classList.toggle('hidden', noLeidas === 0);
  if (btn) btn.classList.toggle('animate-pulse', noLeidas > 0);
}

function renderNotificaciones() {
  const container = document.getElementById('notif-lista');
  if (!container) return;
  if (notificaciones.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-sm text-slate-400">Sin notificaciones</div>';
    return;
  }
  container.innerHTML = notificaciones.map(n => {
    const fecha = new Date(n.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const tipoIcono: any = { nueva_solicitud: 'bell', rebote: 'x-circle', bancarizado: 'circle-check', eliminado: 'trash-2' };
    const tipoColor: any = { nueva_solicitud: 'text-fluent-accent', rebote: 'text-red-400', bancarizado: 'text-emerald-400', eliminado: 'text-slate-400' };
    return `<div class="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${n.leido ? 'opacity-60' : ''}">
      <i data-lucide="${tipoIcono[n.tipo] || 'bell'}" class="w-4 h-4 mt-0.5 ${tipoColor[n.tipo] || 'text-slate-400'} shrink-0"></i>
      <div class="flex-1 min-w-0">
        <p class="text-xs text-slate-200 font-semibold leading-snug">${n.mensaje}</p>
        <p class="text-[10px] text-slate-500 mt-1">${fecha}</p>
      </div>
      <button class="btn-eliminar-notif p-1 rounded hover:bg-white/10 transition-colors text-slate-500 hover:text-red-400 shrink-0" data-id="${n.id}" title="Eliminar">
        <i data-lucide="x" class="w-3 h-3"></i>
      </button>
    </div>`;
  }).join('');
  createIcons();
  container.querySelectorAll('.btn-eliminar-notif').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      const r = await window.electronAPI.db.eliminarNotificacion(id);
      if (r.success) {
        notificaciones = notificaciones.filter(n => n.id !== id);
        actualizarBadgeNotif();
        renderNotificaciones();
      }
    });
  });
}

function toggleNotifDropdown() {
  notifDropdownAbierto = !notifDropdownAbierto;
  const panel = document.getElementById('notif-panel');
  const btn = document.getElementById('btn-notificaciones');
  if (!panel) return;
  if (notifDropdownAbierto && btn) {
    const rect = btn.getBoundingClientRect();
    panel.style.top = (rect.bottom + 8) + 'px';
    panel.style.right = (window.innerWidth - rect.right) + 'px';
    panel.style.left = 'auto';
    panel.classList.remove('hidden');
    renderNotificaciones();
    // Marcar todas como leídas
    if (currentUser?.id) {
      window.electronAPI.db.marcarNotificacionesLeidas(currentUser.id);
      notificaciones.forEach(n => n.leido = true);
      actualizarBadgeNotif();
    }
  } else {
    panel.classList.add('hidden');
  }
}

// --- CARGA DE DATOS ---
async function cargarDatosIniciales() {
  await Promise.all([
    cargarProveedores(),
    cargarServicios(),
    cargarBancos(),
    cargarSedes(),
    cargarNotificaciones(),
  ]);
  if (currentUser?.rol === 'ADMINISTRADOR') {
    await cargarUsuarios();
  }
  await Promise.all([
    cargarMisSolicitudes(),
    cargarDashboard(),
  ]);
  if (currentUser?.rol === 'CFO') {
    await cargarBandejaCFO();
  }
  await cargarBancarizados();
}

// --- DASHBOARD ---
async function cargarDashboard() {
  const rol = currentUser?.rol;
  const esCFO = rol === 'CFO';
  const res = await window.electronAPI.db.listarSolicitudes(esCFO ? 'cfo-bandeja' : 'mis-solicitudes', rol);
  const solicitudes = res.success && Array.isArray(res.solicitudes) ? res.solicitudes : [];
  const pendientes = solicitudes.filter((s: any) => s.estado === 'PENDIENTE').length;
  const observados = solicitudes.filter((s: any) => s.estado === 'OBSERVADO').length;

  const resBanc = await window.electronAPI.db.listarSolicitudes('bancarizados', rol);
  const bancarizados = resBanc.success && Array.isArray(resBanc.solicitudes) ? resBanc.solicitudes.length : 0;

  setText('dashboard-pendientes', String(pendientes + observados));
  setText('dashboard-por-bancarizar', String(esCFO ? pendientes : pendientes));
  setText('dashboard-bancarizados', String(bancarizados));

  // Populate recent table
  const recientesBody = document.getElementById('dashboard-recientes-body');
  const recientesTable = document.getElementById('dashboard-recientes-table');
  const recientesEmpty = document.getElementById('dashboard-recientes-empty');
  const recientes = solicitudes.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
  if (recientesBody && recientesTable && recientesEmpty) {
    if (recientes.length === 0) {
      recientesTable.classList.add('hidden');
      recientesEmpty.classList.remove('hidden');
    } else {
      recientesTable.classList.remove('hidden');
      recientesEmpty.classList.add('hidden');
      recientesBody.innerHTML = recientes.map((s: any) => {
        const badgeClass = s.estado === 'BANCARIZADO' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
          s.estado === 'OBSERVADO' ? 'bg-red-400/10 text-red-400 border-red-400/20' :
          'bg-amber-400/10 text-amber-400 border-amber-400/20';
        return `<tr class="hover:bg-white/5 transition-colors">
          <td class="px-8 py-4 text-xs">${new Date(s.created_at).toLocaleDateString()}</td>
          <td class="px-8 py-4 text-sm text-slate-200">${(servicioMap.get(s.servicio_id)?.nombre) || '-'}</td>
          <td class="px-8 py-4 text-sm font-bold text-white">${(proveedorMap.get(s.proveedor_id)?.nombre_razon_social) || '-'}</td>
          <td class="px-8 py-4 text-sm font-bold text-emerald-400">S/ ${Number(s.monto).toFixed(2)}</td>
          <td class="px-8 py-4"><span class="px-2 py-1 rounded text-[10px] font-bold tracking-wider ${badgeClass}">${s.estado}</span></td>
        </tr>`;
      }).join('');
    }
  }
}

function skeletonRows(tbodyId: string, cols: number, rows = 5) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = Array.from({ length: rows }, () =>
    `<tr>${Array.from({ length: cols }, () => '<td class="px-8 py-4"><div class="skeleton h-4 w-24"></div></td>').join('')}</tr>`
  ).join('');
}

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// --- MIS SOLICITUDES ---
async function cargarMisSolicitudes() {
  skeletonRows('table-body-mis-solicitudes', 7);
  const res = await window.electronAPI.db.listarSolicitudes('mis-solicitudes', currentUser?.rol || '');
  const tbody = document.getElementById('table-body-mis-solicitudes');
  if (!tbody) return;
  const solicitudes = res.success && Array.isArray(res.solicitudes) ? res.solicitudes : [];
  if (solicitudes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-500">No tienes solicitudes pendientes.</td></tr>`;
    return;
  }
  tbody.innerHTML = solicitudes.map((s: any) => `
    <tr class="hover:bg-white/5 transition-colors">
      <td class="px-8 py-4">${new Date(s.created_at).toLocaleDateString()}</td>
      <td class="px-8 py-4 text-slate-200">${(servicioMap.get(s.servicio_id)?.nombre) || '-'}</td>
      <td class="px-8 py-4 font-bold text-white">${(proveedorMap.get(s.proveedor_id)?.nombre_razon_social) || '-'}</td>
      <td class="px-8 py-4 font-bold text-emerald-400">S/ ${Number(s.monto).toFixed(2)}</td>
      <td class="px-8 py-4">
        <span class="px-2 py-1 rounded text-[10px] font-bold tracking-wider ${s.estado === 'PENDIENTE' ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' : 'bg-red-400/10 text-red-400 border border-red-400/20'}">${s.estado}</span>
      </td>
      <td class="px-8 py-4 text-slate-400 text-xs">${s.observacion_motivo || '-'}</td>
      <td class="px-8 py-4 text-right space-x-2">
        <button class="btn-ver-solicitud p-1.5 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 transition-colors" data-id="${s.id}" title="Ver detalle"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
        ${s.estado === 'OBSERVADO' ? `<button class="btn-editar-solicitud p-1.5 rounded-lg bg-fluent-accent/15 text-fluent-accent hover:bg-fluent-accent/25 transition-colors" data-id="${s.id}" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>` : ''}
        ${s.estado !== 'BANCARIZADO' ? `<button class="btn-eliminar-solicitud p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors" data-id="${s.id}" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>` : ''}
      </td>
    </tr>
  `).join('');
  createIcons();

  tbody.querySelectorAll('.btn-ver-solicitud').forEach(btn => {
    btn.addEventListener('click', () => abrirModalDetalle(btn.getAttribute('data-id')!));
  });
  tbody.querySelectorAll('.btn-editar-solicitud').forEach(btn => {
    btn.addEventListener('click', () => abrirModalSolicitud(btn.getAttribute('data-id')));
  });
  tbody.querySelectorAll('.btn-eliminar-solicitud').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      if (!await confirmDialog('¿Eliminar esta solicitud?')) return;
      const r = await window.electronAPI.db.eliminarSolicitud(id);
      if (r.success) { toast('Solicitud eliminada correctamente', 'success'); await Promise.all([cargarMisSolicitudes(), cargarDashboard(), cargarBancarizados()]); } else { toast('Error: ' + r.error, 'error'); }
    });
  });
}

// --- MODAL SOLICITUD (Nueva / Editar) ---
async function abrirModalSolicitud(solicitudId: string | null = null) {
  editingSolicitudId = solicitudId;
  solicitudFiles.length = 0;
  archivosExistentes = [];
  archivosAEliminar = [];
  const titleEl = document.getElementById('modal-solicitud-title');
  const btnSubmit = document.getElementById('btn-submit-solicitud');
  if (titleEl) titleEl.textContent = solicitudId ? 'Editar Solicitud' : 'Nueva Solicitud';
  if (btnSubmit) btnSubmit.textContent = solicitudId ? 'Actualizar y Reenviar' : 'Enviar Solicitud';

  const form = document.getElementById('form-solicitud') as HTMLFormElement;
  form.reset();
  document.getElementById('file-list-solicitud')!.innerHTML = '';
  document.getElementById('alert-detraccion')?.classList.add('hidden');
  document.getElementById('submit-error-solicitud')?.classList.add('hidden');
  document.getElementById('upload-progress-solicitud')?.classList.add('hidden');

  if (solicitudId) {
    const res = await window.electronAPI.db.listarSolicitudes('mis-solicitudes', currentUser?.rol || '');
    if (res.success && Array.isArray(res.solicitudes)) {
      const sol = res.solicitudes.find((s: any) => s.id === solicitudId);
      if (sol) {
        (document.getElementById('input-servicio') as HTMLSelectElement).value = sol.servicio_id || '';
        (document.getElementById('input-proveedor') as HTMLSelectElement).value = sol.proveedor_id;
        (document.getElementById('input-monto') as HTMLInputElement).value = sol.monto;
        (document.getElementById('input-descripcion') as HTMLTextAreaElement).value = sol.descripcion;
        const serv = servicioMap.get(sol.servicio_id);
        if (serv?.detrae && sol.monto > serv.detraccion) {
          document.getElementById('alert-detraccion-text')!.textContent = `Monto supera el umbral de S/ ${Number(serv.detraccion).toLocaleString()}. Se requiere sustento de depósito.`;
          document.getElementById('alert-detraccion')?.classList.remove('hidden');
        }
        archivosExistentes = (sol.archivos && Array.isArray(sol.archivos)) ? sol.archivos : [];
        renderArchivosEditables();
      }
    }
  }

  openModal('modal-solicitud');
}

function renderArchivosEditables() {
  const container = document.getElementById('file-list-solicitud');
  if (!container) return;
  const items: string[] = [];
  archivosExistentes.forEach((a, i) => {
    items.push(`
      <div class="flex items-center justify-between bg-emerald-500/10 p-2 rounded-lg">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
          <span class="text-xs text-slate-300 truncate">${a.name}</span>
          <span class="text-[10px] text-emerald-400 font-semibold shrink-0">Subido</span>
        </div>
        <button type="button" class="btn-del-existente p-1 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors ml-2 shrink-0" data-index="${i}" title="Eliminar de Drive"><i data-lucide="x" class="w-3 h-3"></i></button>
      </div>
    `);
  });
  solicitudFiles.forEach((f, i) => {
    items.push(`
      <div class="flex items-center justify-between bg-white/5 p-2 rounded-lg">
        <span class="text-xs text-slate-300 truncate">${f.name} <span class="text-[10px] text-amber-400">(pendiente)</span></span>
        <button type="button" class="btn-remove-file p-1 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors ml-2 shrink-0" data-index="${i}" title="Eliminar"><i data-lucide="x" class="w-3 h-3"></i></button>
      </div>
    `);
  });
  container.innerHTML = items.join('');
  createIcons();

  container.querySelectorAll('.btn-del-existente').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-index') || '0');
      const removed = archivosExistentes.splice(idx, 1);
      if (removed[0]?.driveId) {
        archivosAEliminar.push(removed[0].driveId);
      }
      renderArchivosEditables();
    });
  });

  container.querySelectorAll('.btn-remove-file').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index') || '0');
      solicitudFiles.splice(idx, 1);
      renderArchivosEditables();
    });
  });
}

async function submitSolicitud(e: Event) {
  e.preventDefault();
  const servicioId = (document.getElementById('input-servicio') as HTMLSelectElement).value;
  const proveedorId = (document.getElementById('input-proveedor') as HTMLSelectElement).value;
  const monto = parseFloat((document.getElementById('input-monto') as HTMLInputElement).value);
  const descripcion = (document.getElementById('input-descripcion') as HTMLTextAreaElement).value.trim();
  const errorDiv = document.getElementById('submit-error-solicitud');
  const errorText = document.getElementById('submit-error-text-solicitud');
  const progressDiv = document.getElementById('upload-progress-solicitud');
  const progressFill = document.getElementById('progress-bar-fill-solicitud');
  const progressText = document.getElementById('progress-text-solicitud');
  const btn = document.getElementById('btn-submit-solicitud') as HTMLButtonElement;

  if (!servicioId || !proveedorId || !monto || !descripcion) { toast('Completa todos los campos obligatorios', 'error'); return; }
  errorDiv?.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Procesando...';

  try {
    // Eliminar de Drive los archivos marcados para borrar
    if (archivosAEliminar.length > 0) {
      if (progressText) progressText.textContent = 'Eliminando archivos de Drive...';
      progressDiv?.classList.remove('hidden');
      for (const driveId of archivosAEliminar) {
        await window.electronAPI.drive.deleteFile(driveId);
      }
    }

    // Subir archivos nuevos
    const archivosSubidos: ArchivoSubido[] = [];
    if (solicitudFiles.length > 0) {
      progressDiv?.classList.remove('hidden');
      for (let i = 0; i < solicitudFiles.length; i++) {
        const file = solicitudFiles[i];
        const pct = Math.round(((i + 1) / solicitudFiles.length) * 100);
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (progressText) progressText.textContent = `Subiendo ${file.name}...`;

        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
        });

        const driveRes = await window.electronAPI.drive.uploadFile(file.name, file.type, base64Data);
        if (!driveRes.success) throw new Error(`Error al subir ${file.name}: ${driveRes.error}`);
        archivosSubidos.push({
          name: driveRes.file.name,
          driveId: driveRes.file.id,
          driveUrl: driveRes.file.webViewLink
        });
      }
    }

    if (progressText) progressText.textContent = 'Guardando...';

    const serv = servicioMap.get(servicioId);
    const requiereDetraccion = serv?.detrae ? monto > serv.detraccion : false;

    if (editingSolicitudId) {
      const archivosFinales = [...archivosExistentes, ...archivosSubidos];
      const res = await window.electronAPI.db.actualizarSolicitud({
        id: editingSolicitudId,
        descripcion,
        proveedorId,
        servicioId,
        monto,
        requiereDetraccion,
        archivos: archivosFinales
      });
      if (!res.success) throw new Error(res.error || 'Error al actualizar');
    } else {
      const res = await window.electronAPI.db.crearSolicitud({
        proveedorId,
        servicioId,
        descripcion,
        monto,
        requiereDetraccion,
        archivos: archivosSubidos
      });
      if (!res.success) throw new Error(res.error || 'Error al crear');
    }

    closeModal('modal-solicitud');
    archivosExistentes = [];
    archivosAEliminar = [];
    await Promise.all([cargarMisSolicitudes(), cargarDashboard(), cargarBancarizados()]);
  } catch (err: any) {
    if (errorText) errorText.textContent = err.message;
    errorDiv?.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = editingSolicitudId ? 'Actualizar y Reenviar' : 'Enviar Solicitud';
    progressDiv?.classList.add('hidden');
  }
}

// --- BANDEJA CFO ---
async function cargarBandejaCFO() {
  if (currentUser?.rol !== 'CFO') return;
  skeletonRows('table-body-cfo-bandeja', 8);
  const res = await window.electronAPI.db.listarSolicitudes('cfo-bandeja', 'CFO');
  const tbody = document.getElementById('table-body-cfo-bandeja');
  const solicitudes = res.success && Array.isArray(res.solicitudes) ? res.solicitudes : [];
  if (!tbody) return;
  if (solicitudes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-slate-500">No hay solicitudes pendientes.</td></tr>`;
    return;
  }
  tbody.innerHTML = solicitudes.map((s: any) => `
    <tr class="hover:bg-white/5 transition-colors">
      <td class="px-8 py-4">${new Date(s.created_at).toLocaleDateString()}</td>
      <td class="px-8 py-4 text-slate-200">${(servicioMap.get(s.servicio_id)?.nombre) || '-'}</td>
      <td class="px-8 py-4 font-bold text-white">${(perfilMap.get(s.usuario_id)?.nombre) || 'N/A'} ${(perfilMap.get(s.usuario_id)?.apellido) || ''}</td>
      <td class="px-8 py-4">${(proveedorMap.get(s.proveedor_id)?.nombre_razon_social) || '-'}</td>
      <td class="px-8 py-4 font-bold text-emerald-400">S/ ${Number(s.monto).toFixed(2)}</td>
      <td class="px-8 py-4">
        <span class="px-2 py-1 rounded text-[10px] font-bold tracking-wider ${s.estado === 'PENDIENTE' ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' : 'bg-red-400/10 text-red-400 border border-red-400/20'}">${s.estado}</span>
        ${s.observacion_motivo ? `<div class="text-[10px] text-slate-400 mt-1">${s.observacion_motivo}</div>` : ''}
      </td>
      <td class="px-8 py-4">
        ${renderArchivos(s.archivos)}
      </td>
      <td class="px-8 py-4 text-right space-x-2">
        <button class="btn-ver-solicitud p-1.5 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 transition-colors" data-id="${s.id}" title="Ver detalle"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
        <button class="btn-bancarizar p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors" data-id="${s.id}" title="Bancarizar"><i data-lucide="banknote" class="w-3.5 h-3.5"></i></button>
        <button class="btn-observar p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors" data-id="${s.id}" title="Rebotar"><i data-lucide="x-circle" class="w-3.5 h-3.5"></i></button>
      </td>
    </tr>
  `).join('');
  createIcons();

  tbody.querySelectorAll('.btn-ver-solicitud').forEach(btn => {
    btn.addEventListener('click', () => abrirModalDetalle(btn.getAttribute('data-id')!));
  });
  tbody.querySelectorAll('.btn-bancarizar').forEach(btn => {
    btn.addEventListener('click', () => abrirModalBancarizar(btn.getAttribute('data-id')));
  });
  tbody.querySelectorAll('.btn-observar').forEach(btn => {
    btn.addEventListener('click', () => abrirModalObservar(btn.getAttribute('data-id')));
  });
}

function renderArchivos(archivos: any): string {
  if (!archivos || !Array.isArray(archivos) || archivos.length === 0) return '-';
  return archivos.map((a: any) =>
    `<a href="${a.driveUrl}" target="_blank" class="text-[10px] text-fluent-accent hover:underline block">${a.name}</a>`
  ).join('');
}

// --- MODAL OBSERVAR ---
let observarSolicitudId: string | null = null;

function abrirModalObservar(id: string | null) {
  observarSolicitudId = id;
  (document.getElementById('form-observar') as HTMLFormElement).reset();
  openModal('modal-observar');
}

async function submitObservar(e: Event) {
  e.preventDefault();
  const motivo = (document.getElementById('observar-motivo') as HTMLTextAreaElement).value.trim();
  if (!motivo || !observarSolicitudId) return;
  const btn = (e.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement;
  btn.disabled = true; btn.textContent = 'Guardando...';
  const res = await window.electronAPI.db.observarSolicitud(observarSolicitudId, motivo);
  if (res.success) {
    closeModal('modal-observar');
    await Promise.all([cargarBandejaCFO(), cargarDashboard()]);
  } else {
    toast('Error al rebotar: ' + res.error, 'error');
  }
  btn.disabled = false; btn.textContent = 'Rebotar';
}

// --- MODAL BANCARIZAR ---
let bancarizarSolicitudId: string | null = null;

function abrirModalBancarizar(id: string | null) {
  bancarizarSolicitudId = id;
  bancarizarFiles.length = 0;
  document.getElementById('file-list-bancarizar')!.innerHTML = '';
  document.getElementById('submit-error-bancarizar')?.classList.add('hidden');
  document.getElementById('upload-progress-bancarizar')?.classList.add('hidden');
  openModal('modal-bancarizar');
}

// --- MODAL DETALLE ---
async function abrirModalDetalle(id: string) {
  const res = await window.electronAPI.db.obtenerSolicitud(id);
  if (!res.success || !res.solicitud) { toast('Error al cargar detalle: ' + (res.error || 'desconocido'), 'error'); return; }
  const s = res.solicitud;
  const prov = s.proveedor_id ? proveedorMap.get(s.proveedor_id) : null;
  const perfil = s.usuario_id ? perfilMap.get(s.usuario_id) : null;

  setText('detalle-fecha', new Date(s.created_at).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
  setText('detalle-solicitante', perfil ? `${perfil.nombre} ${perfil.apellido}` : '—');
  setText('detalle-servicio', (servicioMap.get(s.servicio_id)?.nombre) || '—');
  setText('detalle-proveedor', prov ? prov.nombre_razon_social : '—');
  setText('detalle-monto', `S/ ${Number(s.monto).toFixed(2)}`);
  setText('detalle-descripcion', s.descripcion || '—');

  // Estado badge
  const estadoBadge = document.getElementById('detalle-estado');
  if (estadoBadge) {
    const colors: any = { PENDIENTE: 'text-amber-400', OBSERVADO: 'text-red-400', BANCARIZADO: 'text-emerald-400' };
    estadoBadge.textContent = s.estado;
    estadoBadge.className = `text-sm font-bold ${colors[s.estado] || 'text-white'}`;
  }

  // Motivo
  const motivoW = document.getElementById('detalle-motivo-wrapper');
  const motivoEl = document.getElementById('detalle-motivo');
  if (s.estado === 'OBSERVADO' && s.observacion_motivo) {
    if (motivoW) motivoW.classList.remove('hidden');
    if (motivoEl) motivoEl.textContent = s.observacion_motivo;
  } else {
    if (motivoW) motivoW.classList.add('hidden');
  }

  // Sustentos
  const sustEl = document.getElementById('detalle-sustentos');
  if (sustEl) sustEl.innerHTML = renderArchivos(s.archivos) || '—';

  // Evidencias
  const evW = document.getElementById('detalle-evidencias-wrapper');
  const evEl = document.getElementById('detalle-evidencias');
  if (s.estado === 'BANCARIZADO' && s.evidencias_bancarizacion?.length) {
    if (evW) evW.classList.remove('hidden');
    if (evEl) evEl.innerHTML = renderArchivos(s.evidencias_bancarizacion);
  } else {
    if (evW) evW.classList.add('hidden');
  }

  openModal('modal-detalle');
}

async function submitBancarizar(e: Event) {
  e.preventDefault();
  const errorDiv = document.getElementById('submit-error-bancarizar');
  const errorText = document.getElementById('submit-error-text-bancarizar');
  const progressDiv = document.getElementById('upload-progress-bancarizar');
  const progressFill = document.getElementById('progress-bar-fill-bancarizar');
  const progressText = document.getElementById('progress-text-bancarizar');
  const btn = (e.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement;

  if (!bancarizarSolicitudId) return;
  if (bancarizarFiles.length === 0) { toast('Adjunta al menos una evidencia', 'error'); return; }

  errorDiv?.classList.add('hidden');
  btn.disabled = true; btn.textContent = 'Procesando...';

  try {
    const evidenciasSubidas: ArchivoSubido[] = [];
    progressDiv?.classList.remove('hidden');

    for (let i = 0; i < bancarizarFiles.length; i++) {
      const file = bancarizarFiles[i];
      const pct = Math.round(((i + 1) / bancarizarFiles.length) * 100);
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressText) progressText.textContent = `Subiendo ${file.name}...`;

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
      });

      const driveRes = await window.electronAPI.drive.uploadFile(file.name, file.type, base64Data);
      if (!driveRes.success) throw new Error(`Error al subir ${file.name}: ${driveRes.error}`);
      evidenciasSubidas.push({
        name: driveRes.file.name,
        driveId: driveRes.file.id,
        driveUrl: driveRes.file.webViewLink
      });
    }

    if (progressText) progressText.textContent = 'Bancarizando...';
    const res = await window.electronAPI.db.bancarizarSolicitud(bancarizarSolicitudId, evidenciasSubidas);
    if (!res.success) throw new Error(res.error || 'Error al bancarizar');

    closeModal('modal-bancarizar');
    await Promise.all([cargarBandejaCFO(), cargarBancarizados(), cargarDashboard()]);
  } catch (err: any) {
    if (errorText) errorText.textContent = err.message;
    errorDiv?.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Confirmar Bancarización';
    progressDiv?.classList.add('hidden');
  }
}

// --- BANCARIZADOS ---
async function cargarBancarizados() {
  const rol = currentUser?.rol || '';
  skeletonRows('table-body-bancarizados', 8);
  const res = await window.electronAPI.db.listarSolicitudes('bancarizados', rol);
  const tbody = document.getElementById('table-body-bancarizados');
  const solicitudes = res.success && Array.isArray(res.solicitudes) ? res.solicitudes : [];
  const esCFO = rol === 'CFO';
  if (!tbody) return;
  if (solicitudes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-slate-500">No hay solicitudes bancarizadas.</td></tr>`;
    return;
  }
  tbody.innerHTML = solicitudes.map((s: any) => `
    <tr class="hover:bg-white/5 transition-colors">
      <td class="px-8 py-4">${new Date(s.updated_at).toLocaleDateString()}</td>
      <td class="px-8 py-4 text-slate-200">${(servicioMap.get(s.servicio_id)?.nombre) || '-'}</td>
      <td class="px-8 py-4 font-bold text-white">${(perfilMap.get(s.usuario_id)?.nombre) || 'N/A'} ${(perfilMap.get(s.usuario_id)?.apellido) || ''}</td>
      <td class="px-8 py-4">${(proveedorMap.get(s.proveedor_id)?.nombre_razon_social) || '-'}</td>
      <td class="px-8 py-4 font-bold text-emerald-400">S/ ${Number(s.monto).toFixed(2)}</td>
      <td class="px-8 py-4">${renderArchivos(s.archivos)}</td>
      <td class="px-8 py-4 text-right">${renderArchivos(s.evidencias_bancarizacion)}</td>
      <td class="px-8 py-4 text-right space-x-2">
        <button class="btn-ver-solicitud p-1.5 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 transition-colors" data-id="${s.id}" title="Ver detalle"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
        ${esCFO ? `<button class="btn-eliminar-bancarizado p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors" data-id="${s.id}" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>` : ''}
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-ver-solicitud').forEach(btn => {
    btn.addEventListener('click', () => abrirModalDetalle(btn.getAttribute('data-id')!));
  });
  tbody.querySelectorAll('.btn-eliminar-bancarizado').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      if (!await confirmDialog('¿Eliminar esta solicitud bancarizada? Se moverá a eliminados.')) return;
      const r = await window.electronAPI.db.eliminarSolicitud(id);
      if (r.success) { toast('Solicitud eliminada', 'success'); await Promise.all([cargarBancarizados(), cargarDashboard()]); } else { toast('Error: ' + r.error, 'error'); }
    });
  });
}

// --- PROVEEDORES ---
async function getBancoMap(): Promise<Map<string, any>> {
  const m = new Map();
  const res = await window.electronAPI.db.listarBancos();
  if (res.success) (res.bancos || []).forEach((b: any) => m.set(b.id, b));
  return m;
}

async function getSedeMap(): Promise<Map<string, any>> {
  const m = new Map();
  const res = await window.electronAPI.db.listarSedes();
  if (res.success) (res.sedes || []).forEach((s: any) => m.set(s.id, s));
  return m;
}

async function cargarProveedoresSelect(res?: any) {
  if (!res) res = await window.electronAPI.db.listarProveedores();
  const select = document.getElementById('input-proveedor') as HTMLSelectElement;
  if (select && res.success) {
    select.innerHTML = '<option value="" disabled selected>Seleccione un proveedor...</option>' +
      (res.proveedores || []).map((p: any) => `<option value="${p.id}">${p.nombre_razon_social}</option>`).join('');
  }
}

async function cargarServiciosSelect(res?: any) {
  if (!res) res = await window.electronAPI.db.listarServicios();
  const select = document.getElementById('input-servicio') as HTMLSelectElement;
  if (select && res.success) {
    select.innerHTML = '<option value="" disabled selected>Seleccione un servicio...</option>' +
      (res.servicios || []).map((s: any) =>
        `<option value="${s.id}">${s.nombre}</option>`
      ).join('');
  }
}

async function cargarServicios() {
  skeletonRows('table-body-servicios', 4);
  const res = await window.electronAPI.db.listarServicios();
  servicioMap = new Map();
  if (res.success) (res.servicios || []).forEach((s: any) => servicioMap.set(s.id, s));
  else toast('Error al cargar servicios: ' + (res.error || 'desconocido'), 'error');
  await cargarServiciosSelect(res);
  const tbody = document.getElementById('table-body-servicios');
  if (tbody && res.success) {
    tbody.innerHTML = (res.servicios || []).map((s: any) =>
      `<tr class="hover:bg-white/5 transition-colors">
        <td class="px-8 py-4 font-bold text-white">${s.nombre}</td>
        <td class="px-8 py-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${s.detrae ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' : 'bg-white/5 text-slate-400 border border-white/10'}">${s.detrae ? 'Sí' : 'No'}</span></td>
        <td class="px-8 py-4">${s.detrae ? `<span class="font-bold text-amber-400">S/ ${Number(s.detraccion).toLocaleString()}</span>` : '<span class="text-slate-500">—</span>'}</td>
        <td class="px-8 py-4 text-right space-x-2">
          <button class="btn-editar-servicio p-1.5 rounded-lg bg-fluent-accent/15 text-fluent-accent hover:bg-fluent-accent/25 transition-colors" data-id="${s.id}" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
          <button class="btn-eliminar-servicio p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors" data-id="${s.id}" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </td>
      </tr>`
    ).join('');
    createIcons();
    tbody.querySelectorAll('.btn-editar-servicio').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const s = (res.servicios || []).find((x: any) => x.id === id);
        if (!s) return;
        (document.getElementById('serv-nombre') as HTMLInputElement).value = s.nombre || '';
        (document.getElementById('serv-detrae') as HTMLInputElement).checked = s.detrae ?? false;
        const fields = document.getElementById('serv-detracion-fields');
        if (fields) fields.style.opacity = s.detrae ? '1' : '0.3';
        (document.getElementById('serv-detraccion') as HTMLInputElement).value = s.detraccion || '';
        (document.getElementById('form-servicio') as HTMLFormElement).setAttribute('data-editing', id || '');
        openModal('modal-servicio');
      });
    });
    tbody.querySelectorAll('.btn-eliminar-servicio').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        if (!await confirmDialog('¿Eliminar este servicio?')) return;
        const r = await window.electronAPI.db.eliminarServicio(id);
        if (r.success) { toast('Servicio eliminado', 'success'); await cargarServicios(); } else { toast('Error: ' + r.error, 'error'); }
      });
    });
  }
}

async function cargarProveedores() {
  skeletonRows('table-body-proveedores', 6);
  const [res, bancoMap, sedeMap, perfilesRes] = await Promise.all([
    window.electronAPI.db.listarProveedores(),
    getBancoMap(),
    getSedeMap(),
    window.electronAPI.db.listarPerfiles(),
  ]);
  proveedorMap = new Map();
  if (res.success) (res.proveedores || []).forEach((p: any) => proveedorMap.set(p.id, p));
  if (perfilesRes.success) {
    const pm = new Map<string, any>();
    (perfilesRes.perfiles || []).forEach((p: any) => pm.set(p.id, p));
    perfilMap = pm;
  }
  await cargarProveedoresSelect(res);
  const tbody = document.getElementById('table-body-proveedores');
  if (tbody && res.success) {
    tbody.innerHTML = (res.proveedores || []).map((p: any) => {
      const banco = bancoMap.get(p.banco_id);
      const sede = sedeMap.get(p.sede_id);
      return `<tr class="hover:bg-white/5 transition-colors">
        <td class="px-8 py-4 font-bold text-white">${p.nombre_razon_social}</td>
        <td class="px-8 py-4 text-slate-400">${p.correo || '-'}</td>
        <td class="px-8 py-4">${banco ? `${banco.nombre} — ${banco.moneda}` : '-'}</td>
        <td class="px-8 py-4">${p.numero_cuenta || '-'}</td>
        <td class="px-8 py-4">${sede ? sede.nombre : '-'}</td>
        <td class="px-8 py-4">${p.cci || '-'}</td>
        <td class="px-8 py-4 text-right space-x-2">
          <button class="btn-editar-proveedor p-1.5 rounded-lg bg-fluent-accent/15 text-fluent-accent hover:bg-fluent-accent/25 transition-colors" data-id="${p.id}" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
          <button class="btn-eliminar-proveedor p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors" data-id="${p.id}" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </td>
      </tr>`;
    }).join('');
    createIcons();
    tbody.querySelectorAll('.btn-editar-proveedor').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const p = (res.proveedores || []).find((x: any) => x.id === id);
        if (!p) return;
        (document.getElementById('prov-nombre') as HTMLInputElement).value = p.nombre_razon_social || '';
        (document.getElementById('prov-correo') as HTMLInputElement).value = p.correo || '';
        (document.getElementById('prov-banco-id') as HTMLSelectElement).value = p.banco_id || '';
        (document.getElementById('prov-cuenta') as HTMLInputElement).value = p.numero_cuenta || '';
        (document.getElementById('prov-sede-id') as HTMLSelectElement).value = p.sede_id || '';
        (document.getElementById('prov-cci') as HTMLInputElement).value = p.cci || '';
        (document.getElementById('form-proveedor') as HTMLFormElement).setAttribute('data-editing', id || '');
        openModal('modal-proveedor');
      });
    });
    tbody.querySelectorAll('.btn-eliminar-proveedor').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        if (!await confirmDialog('¿Eliminar este proveedor?')) return;
        const r = await window.electronAPI.db.eliminarProveedor(id);
        if (r.success) { toast('Proveedor eliminado', 'success'); await cargarProveedores(); } else { toast('Error: ' + r.error, 'error'); }
      });
    });
  }
}

// --- BANCOS ---
async function cargarBancos() {
  skeletonRows('table-body-bancos', 4);
  const [res, sedeMap] = await Promise.all([
    window.electronAPI.db.listarBancos(),
    getSedeMap(),
  ]);
  const selects: { id: string; isSede: boolean }[] = [
    { id: 'banco-sede-id', isSede: true },
    { id: 'prov-banco-id', isSede: false },
  ];
  selects.forEach(({ id, isSede }) => {
    const sel = document.getElementById(id) as HTMLSelectElement;
    if (!sel) return;
    if (isSede) {
      sel.innerHTML = '<option value="" disabled selected>Seleccione sede...</option>' +
        [...sedeMap.values()].map((s: any) => `<option value="${s.id}">${s.nombre}</option>`).join('');
    } else if (res.success) {
      sel.innerHTML = '<option value="">Seleccione...</option>' +
        (res.bancos || []).map((b: any) => {
          const sede = sedeMap.get(b.sede_id);
          return `<option value="${b.id}">${b.nombre} — ${b.moneda}${sede ? ` (${sede.nombre})` : ''}</option>`;
        }).join('');
    }
  });
  const tbody = document.getElementById('table-body-bancos');
  if (tbody && res.success) {
    tbody.innerHTML = (res.bancos || []).map((b: any) => {
      const sede = sedeMap.get(b.sede_id);
      return `<tr class="hover:bg-white/5 transition-colors">
        <td class="px-8 py-4 font-bold text-white">${b.nombre}</td>
        <td class="px-8 py-4">${b.moneda || 'Soles'}</td>
        <td class="px-8 py-4 text-slate-300">${sede ? sede.nombre : '-'}</td>
        <td class="px-8 py-4 text-right space-x-2">
          <button class="btn-editar-banco p-1.5 rounded-lg bg-fluent-accent/15 text-fluent-accent hover:bg-fluent-accent/25 transition-colors" data-id="${b.id}" data-nombre="${b.nombre}" data-moneda="${b.moneda || 'Soles'}" data-sede-id="${b.sede_id || ''}" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
          <button class="btn-eliminar-banco p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors" data-id="${b.id}" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </td>
      </tr>`;
    }).join('');
    createIcons();
    tbody.querySelectorAll('.btn-editar-banco').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const nombre = btn.getAttribute('data-nombre');
        const moneda = btn.getAttribute('data-moneda');
        const sedeId = btn.getAttribute('data-sede-id');
        (document.getElementById('banco-nombre') as HTMLInputElement).value = nombre || '';
        (document.getElementById('banco-moneda') as HTMLSelectElement).value = moneda || 'Soles';
        (document.getElementById('banco-sede-id') as HTMLSelectElement).value = sedeId || '';
        (document.getElementById('form-banco') as HTMLFormElement).setAttribute('data-editing', id || '');
        openModal('modal-banco');
      });
    });
    tbody.querySelectorAll('.btn-eliminar-banco').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        if (!await confirmDialog('¿Eliminar este banco?')) return;
        const res = await window.electronAPI.db.eliminarBanco(id);
        if (res.success) { toast('Banco eliminado', 'success'); await cargarBancos(); } else { toast('Error: ' + res.error, 'error'); }
      });
    });
  }
}

// --- SEDES ---
async function cargarSedes() {
  skeletonRows('table-body-sedes', 2);
  const res = await window.electronAPI.db.listarSedes();
  const selects = ['prov-sede-id'];
  selects.forEach(id => {
    const sel = document.getElementById(id) as HTMLSelectElement;
    if (sel && res.success) {
      sel.innerHTML = '<option value="">Seleccione...</option>' +
        (res.sedes || []).map((s: any) => `<option value="${s.id}">${s.nombre}</option>`).join('');
    }
  });
  const tbody = document.getElementById('table-body-sedes');
  if (tbody && res.success) {
    tbody.innerHTML = (res.sedes || []).map((s: any) =>
      `<tr class="hover:bg-white/5 transition-colors">
        <td class="px-8 py-4 font-bold text-white">${s.nombre}</td>
        <td class="px-8 py-4 text-right space-x-2">
          <button class="btn-editar-sede p-1.5 rounded-lg bg-fluent-accent/15 text-fluent-accent hover:bg-fluent-accent/25 transition-colors" data-id="${s.id}" data-nombre="${s.nombre}" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
          <button class="btn-eliminar-sede p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors" data-id="${s.id}" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </td>
      </tr>`
    ).join('');
    createIcons();
    tbody.querySelectorAll('.btn-editar-sede').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const nombre = btn.getAttribute('data-nombre');
        (document.getElementById('sede-nombre') as HTMLInputElement).value = nombre || '';
        (document.getElementById('form-sede') as HTMLFormElement).setAttribute('data-editing', id || '');
        openModal('modal-sede');
      });
    });
    tbody.querySelectorAll('.btn-eliminar-sede').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        if (!await confirmDialog('¿Eliminar esta sede?')) return;
        const res = await window.electronAPI.db.eliminarSede(id);
        if (res.success) { toast('Sede eliminada', 'success'); await cargarSedes(); } else { toast('Error: ' + res.error, 'error'); }
      });
    });
  }
}

// --- USUARIOS ---
async function cargarUsuarios() {
  skeletonRows('table-body-usuarios', 5);
  const res = await window.electronAPI.auth.listarUsuarios();
  const tbody = document.getElementById('table-body-usuarios');
  if (tbody && res.success) {
    tbody.innerHTML = (res.usuarios || []).map((u: any) => `
      <tr class="hover:bg-white/5 transition-colors">
        <td class="px-8 py-4 font-bold text-white">${u.nombre} ${u.apellido}</td>
        <td class="px-8 py-4 text-slate-400">${u.email}</td>
        <td class="px-8 py-4"><span class="px-2 py-1 bg-white/10 rounded text-[10px] font-bold tracking-wider">${u.rol}</span></td>
        <td class="px-8 py-4">${new Date(u.created_at).toLocaleDateString()}</td>
        <td class="px-8 py-4 text-right space-x-2">
          <button class="btn-editar-usuario p-1.5 rounded-lg bg-fluent-accent/15 text-fluent-accent hover:bg-fluent-accent/25 transition-colors" data-id="${u.id}" data-nombre="${u.nombre}" data-apellido="${u.apellido}" data-rol="${u.rol}" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
          <button class="btn-eliminar-usuario p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors" data-id="${u.id}" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </td>
      </tr>
    `).join('');
    createIcons();
    tbody.querySelectorAll('.btn-editar-usuario').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const nombre = btn.getAttribute('data-nombre');
        const apellido = btn.getAttribute('data-apellido');
        const rol = btn.getAttribute('data-rol');
        (document.getElementById('usr-nombre') as HTMLInputElement).value = nombre || '';
        (document.getElementById('usr-apellido') as HTMLInputElement).value = apellido || '';
        (document.getElementById('usr-correo') as HTMLInputElement).value = '';
        (document.getElementById('usr-correo') as HTMLInputElement).disabled = true;
        (document.getElementById('usr-contrasena') as HTMLInputElement).value = '';
        (document.getElementById('usr-contrasena') as HTMLInputElement).disabled = true;
        (document.getElementById('usr-rol') as HTMLSelectElement).value = rol || 'RRHH';
        (document.getElementById('form-usuario') as HTMLFormElement).setAttribute('data-editing', id || '');
        openModal('modal-usuario');
      });
    });
    tbody.querySelectorAll('.btn-eliminar-usuario').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        if (!await confirmDialog('¿Eliminar este usuario? Esta acción no se puede deshacer.', 'Eliminar', true)) return;
        const r = await window.electronAPI.auth.eliminarUsuario(id);
        if (r.success) { toast('Usuario eliminado', 'success'); await cargarUsuarios(); } else { toast('Error: ' + r.error, 'error'); }
      });
    });
  }
}

// --- FILE DROP HELPERS ---
function setupFileDropzone(dropzoneId: string, inputId: string, browseId: string, listId: string, fileArray: { files: File[] }, onUpdate?: () => void) {
  const dropzone = document.getElementById(dropzoneId);
  const input = document.getElementById(inputId) as HTMLInputElement;
  const browse = document.getElementById(browseId);
  const list = document.getElementById(listId);

  if (!dropzone || !input) return;

  if (browse) browse.addEventListener('click', () => input.click());
  dropzone.addEventListener('click', (e) => { if ((e.target as HTMLElement) !== browse) input.click(); });

  const updateList = () => {
    if (onUpdate) onUpdate();
    else renderFileList(listId, fileArray.files, fileArray);
  };

  input.addEventListener('change', () => {
    if (input.files) {
      for (let i = 0; i < input.files.length; i++) {
        fileArray.files.push(input.files[i]);
      }
      updateList();
    }
  });

  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('fluent-dropzone-active'); });
  dropzone.addEventListener('dragleave', (e) => { e.preventDefault(); dropzone.classList.remove('fluent-dropzone-active'); });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('fluent-dropzone-active');
    if (e.dataTransfer?.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        fileArray.files.push(e.dataTransfer.files[i]);
      }
      updateList();
    }
  });
}

function renderFileList(listId: string, files: File[], fileArray: { files: File[] }) {
  const list = document.getElementById(listId);
  if (!list) return;
  if (files.length === 0) { list.innerHTML = ''; return; }
  list.innerHTML = files.map((f, idx) => `
    <div class="flex items-center justify-between bg-white/5 p-2 rounded-lg">
      <span class="text-xs text-slate-300 truncate">${f.name}</span>
      <button type="button" class="btn-remove-file p-1 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors ml-2" data-index="${idx}" title="Eliminar"><i data-lucide="x" class="w-3 h-3"></i></button>
    </div>
  `).join('');
  createIcons();

  list.querySelectorAll('.btn-remove-file').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index') || '0');
      fileArray.files.splice(idx, 1);
      renderFileList(listId, fileArray.files, fileArray);
    });
  });
}

function resetAllForms() {
  const forms = ['form-solicitud', 'form-proveedor', 'form-banco', 'form-sede', 'form-usuario', 'form-observar', 'form-bancarizar'];
  forms.forEach(id => {
    const form = document.getElementById(id) as HTMLFormElement;
    if (form) {
      form.reset();
      form.removeAttribute('data-editing');
    }
  });
  document.getElementById('file-list-solicitud')!.innerHTML = '';
  document.getElementById('file-list-bancarizar')!.innerHTML = '';
  document.getElementById('submit-error-solicitud')?.classList.add('hidden');
  document.getElementById('submit-error-bancarizar')?.classList.add('hidden');
  document.getElementById('upload-progress-solicitud')?.classList.add('hidden');
  document.getElementById('upload-progress-bancarizar')?.classList.add('hidden');
  document.getElementById('alert-detraccion')?.classList.add('hidden');
  (document.getElementById('usr-correo') as HTMLInputElement).disabled = false;
  (document.getElementById('usr-contrasena') as HTMLInputElement).disabled = false;
  solicitudFiles.length = 0;
  bancarizarFiles.length = 0;
  editingSolicitudId = null;
  archivosExistentes = [];
  archivosAEliminar = [];
}

// --- NAVEGACIÓN SPA ---
function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');
  const titleEl = document.getElementById('current-view-title');

  const titleMap: any = {
    'view-dashboard': 'Dashboard General',
    'view-mis-solicitudes': 'Mis Solicitudes',
    'view-cfo-bandeja': 'Bandeja CFO',
    'view-bancarizados': 'Solicitudes Bancarizadas',
    'view-proveedores': 'Proveedores',
    'view-bancos': 'Bancos',
    'view-sedes': 'Sedes',
    'view-usuarios': 'Gestión de Usuarios'
  };

  navLinks.forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('data-target');

      resetAllForms();

      navLinks.forEach(l => {
        l.classList.remove('nav-link-active');
        l.classList.add('nav-link-inactive');
      });
      link.classList.add('nav-link-active');
      link.classList.remove('nav-link-inactive');

      if (titleEl && targetId) titleEl.textContent = titleMap[targetId] || 'BancaFlow';

      sections.forEach(section => {
        if (section.id === targetId) section.classList.remove('hidden');
        else section.classList.add('hidden');
      });

      // Recargar datos según la vista seleccionada
      if (targetId === 'view-dashboard') {
        await cargarDashboard();
      } else if (targetId === 'view-mis-solicitudes') {
        await cargarMisSolicitudes();
      } else if (targetId === 'view-cfo-bandeja' && currentUser?.rol === 'CFO') {
        await cargarBandejaCFO();
      } else if (targetId === 'view-bancarizados') {
        await cargarBancarizados();
      } else if (targetId === 'view-proveedores') {
        await cargarProveedores();
      } else if (targetId === 'view-bancos') {
        await cargarBancos();
      } else if (targetId === 'view-servicios') {
        await cargarServicios();
      } else if (targetId === 'view-sedes') {
        await cargarSedes();
      } else if (targetId === 'view-usuarios' && currentUser?.rol === 'ADMINISTRADOR') {
        await cargarUsuarios();
      }
    });
  });
}

// --- EVENTOS ---
function setupEventListeners() {
  // Login
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const correo = (document.getElementById('login-email') as HTMLInputElement).value.trim();
    const contrasena = (document.getElementById('login-password') as HTMLInputElement).value;
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
        if (loginBtn) loginBtn.disabled = false;
        if (loginBtnText) loginBtnText.textContent = 'Iniciar Sesión';
        if (loginBtnSpinner) loginBtnSpinner.classList.add('hidden');
      }
    } catch (err: any) {
      if (loginError) {
        loginError.textContent = err.message || 'Error de conexión';
        loginError.classList.remove('hidden');
      }
      if (loginBtn) loginBtn.disabled = false;
      if (loginBtnText) loginBtnText.textContent = 'Iniciar Sesión';
      if (loginBtnSpinner) loginBtnSpinner.classList.add('hidden');
    }
  });

  // Notificaciones: usar mousedown para evitar interferencia de drag-region
  document.getElementById('btn-notificaciones')?.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    toggleNotifDropdown();
  });

  // Cerrar panel al hacer clic fuera
  document.addEventListener('mousedown', (e) => {
    const panel = document.getElementById('notif-panel');
    const btn = document.getElementById('btn-notificaciones');
    if (notifDropdownAbierto && panel && btn && !panel.contains(e.target as Node) && !btn.contains(e.target as Node)) {
      notifDropdownAbierto = false;
      panel.classList.add('hidden');
    }
  });

  // Logout
  logoutBtn?.addEventListener('click', async () => {
    if (await confirmDialog('¿Cerrar sesión en BancaFlow?', 'Cerrar sesión', false)) {
      await window.electronAPI.auth.logout();
      window.location.reload();
    }
  });

  // Monto + Servicio → detracción dinámica
  const actualizarDetraccion = () => {
    const monto = parseFloat((document.getElementById('input-monto') as HTMLInputElement).value);
    const servId = (document.getElementById('input-servicio') as HTMLSelectElement).value;
    const serv = servicioMap.get(servId);
    const alert = document.getElementById('alert-detraccion');
    const alertText = document.getElementById('alert-detraccion-text');
    if (alert && alertText) {
      if (serv?.detrae && monto > serv.detraccion) {
        alertText.textContent = `Monto supera el umbral de S/ ${Number(serv.detraccion).toLocaleString()}. Se requiere sustento de depósito.`;
        alert.classList.remove('hidden');
      } else {
        alert.classList.add('hidden');
      }
    }
  };
  document.getElementById('input-monto')?.addEventListener('input', actualizarDetraccion);
  document.getElementById('input-servicio')?.addEventListener('change', actualizarDetraccion);

  // Botón Nueva Solicitud
  document.getElementById('btn-nueva-solicitud')?.addEventListener('click', () => abrirModalSolicitud(null));

  // Form Solicitud
  document.getElementById('form-solicitud')?.addEventListener('submit', submitSolicitud);
  document.getElementById('btn-cancel-solicitud')?.addEventListener('click', () => closeModal('modal-solicitud'));

  // Form Observar
  document.getElementById('form-observar')?.addEventListener('submit', submitObservar);
  document.getElementById('btn-cancel-observar')?.addEventListener('click', () => closeModal('modal-observar'));

  // Form Bancarizar
  document.getElementById('form-bancarizar')?.addEventListener('submit', submitBancarizar);
  document.getElementById('btn-cancel-bancarizar')?.addEventListener('click', () => closeModal('modal-bancarizar'));

  // Modal Detalle
  document.getElementById('btn-cerrar-detalle')?.addEventListener('click', () => closeModal('modal-detalle'));
  document.getElementById('btn-cerrar-detalle-bottom')?.addEventListener('click', () => closeModal('modal-detalle'));

  // Form Proveedor
  document.getElementById('form-proveedor')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = (e.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true; btn.textContent = 'Guardando...';
    const datos = {
      nombre_razon_social: (document.getElementById('prov-nombre') as HTMLInputElement).value.trim(),
      correo: (document.getElementById('prov-correo') as HTMLInputElement).value.trim() || null,
      banco_id: (document.getElementById('prov-banco-id') as HTMLSelectElement).value || null,
      numero_cuenta: (document.getElementById('prov-cuenta') as HTMLInputElement).value.trim() || null,
      sede_id: (document.getElementById('prov-sede-id') as HTMLSelectElement).value || null,
      cci: (document.getElementById('prov-cci') as HTMLInputElement).value.trim() || null,
    };
    try {
      const form = document.getElementById('form-proveedor') as HTMLFormElement;
      const editing = form.getAttribute('data-editing');
      const res = editing
        ? await window.electronAPI.db.actualizarProveedor(editing, datos)
        : await window.electronAPI.db.crearProveedor(datos);
      if (res.success) {
        closeModal('modal-proveedor');
        form.reset();
        form.removeAttribute('data-editing');
        await cargarProveedores();
      } else { toast('Error: ' + res.error, 'error'); }
    } catch (err: any) { toast('Error: ' + err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Guardar'; }
  });
  document.getElementById('btn-add-proveedor')?.addEventListener('click', () => openModal('modal-proveedor'));
  document.getElementById('btn-cancel-proveedor')?.addEventListener('click', () => closeModal('modal-proveedor'));

  // Form Banco
  document.getElementById('form-banco')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = document.getElementById('form-banco') as HTMLFormElement;
    const editing = form.getAttribute('data-editing');
    const nombre = (document.getElementById('banco-nombre') as HTMLInputElement).value.trim();
    const moneda = (document.getElementById('banco-moneda') as HTMLSelectElement).value;
    const sedeId = (document.getElementById('banco-sede-id') as HTMLSelectElement).value;
    console.log('[DEBUG] form-banco submit', { editing, nombre, moneda, sedeId });
    if (!nombre) return;
    if (!sedeId) { toast('Debe seleccionar una sede', 'error'); return; }
    const res = editing
      ? await window.electronAPI.db.actualizarBanco(editing, nombre, moneda, sedeId)
      : await window.electronAPI.db.crearBanco(nombre, moneda, sedeId);
    console.log('[DEBUG] form-banco result', res);
    if (res.success) {
      closeModal('modal-banco');
      form.reset();
      form.removeAttribute('data-editing');
      await Promise.all([cargarBancos(), cargarProveedores()]);
    } else { toast('Error: ' + (res.error || 'desconocido'), 'error'); }
  });
  document.getElementById('btn-add-banco')?.addEventListener('click', () => openModal('modal-banco'));
  document.getElementById('btn-cancel-banco')?.addEventListener('click', () => closeModal('modal-banco'));

  // Toggle detrae → mostrar/ocultar campo umbral
  document.getElementById('serv-detrae')?.addEventListener('change', () => {
    const checked = (document.getElementById('serv-detrae') as HTMLInputElement).checked;
    const fields = document.getElementById('serv-detracion-fields');
    if (fields) fields.style.opacity = checked ? '1' : '0.3';
  });

  // Form Servicio
  document.getElementById('form-servicio')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = (e.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true; btn.textContent = 'Guardando...';
    const detrae = (document.getElementById('serv-detrae') as HTMLInputElement).checked;
    const datos = {
      nombre: (document.getElementById('serv-nombre') as HTMLInputElement).value.trim(),
      detrae,
      detraccion: detrae ? parseInt((document.getElementById('serv-detraccion') as HTMLInputElement).value) || 0 : 0,
    };
    try {
      const form = document.getElementById('form-servicio') as HTMLFormElement;
      const editing = form.getAttribute('data-editing');
      const res = editing
        ? await window.electronAPI.db.actualizarServicio(editing, datos)
        : await window.electronAPI.db.crearServicio(datos);
      if (res.success) {
        closeModal('modal-servicio');
        form.reset();
        form.removeAttribute('data-editing');
        await cargarServicios();
      } else { toast('Error: ' + res.error, 'error'); }
    } catch (err: any) { toast('Error: ' + err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Guardar'; }
  });
  document.getElementById('btn-add-servicio')?.addEventListener('click', () => openModal('modal-servicio'));
  document.getElementById('btn-cancel-servicio')?.addEventListener('click', () => closeModal('modal-servicio'));

  // Form Sede
  document.getElementById('form-sede')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = document.getElementById('form-sede') as HTMLFormElement;
    const editing = form.getAttribute('data-editing');
    const nombre = (document.getElementById('sede-nombre') as HTMLInputElement).value.trim();
    if (!nombre) return;
    const res = editing
      ? await window.electronAPI.db.actualizarSede(editing, nombre)
      : await window.electronAPI.db.crearSede(nombre);
    if (res.success) {
      closeModal('modal-sede');
      form.reset();
      form.removeAttribute('data-editing');
      await Promise.all([cargarSedes(), cargarProveedores()]);
    } else { toast('Error: ' + res.error, 'error'); }
  });
  document.getElementById('btn-add-sede')?.addEventListener('click', () => openModal('modal-sede'));
  document.getElementById('btn-cancel-sede')?.addEventListener('click', () => closeModal('modal-sede'));

  // Form Usuario
  document.getElementById('form-usuario')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = (e.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true; btn.textContent = 'Guardando...';
    const datos = {
      nombre: (document.getElementById('usr-nombre') as HTMLInputElement).value.trim(),
      apellido: (document.getElementById('usr-apellido') as HTMLInputElement).value.trim(),
      correo: (document.getElementById('usr-correo') as HTMLInputElement).value.trim(),
      contrasena: (document.getElementById('usr-contrasena') as HTMLInputElement).value,
      rol: (document.getElementById('usr-rol') as HTMLSelectElement).value,
    };
    try {
      const form = document.getElementById('form-usuario') as HTMLFormElement;
      const editing = form.getAttribute('data-editing');
      const res = editing
        ? await window.electronAPI.auth.actualizarUsuario(editing, datos.nombre, datos.apellido, datos.rol)
        : await window.electronAPI.auth.crearUsuario(datos);
      if (res.success) {
        closeModal('modal-usuario');
        form.reset();
        form.removeAttribute('data-editing');
        (document.getElementById('usr-correo') as HTMLInputElement).disabled = false;
        (document.getElementById('usr-contrasena') as HTMLInputElement).disabled = false;
        await cargarUsuarios();
      } else { toast('Error: ' + res.error, 'error'); }
    } catch (err: any) { toast('Error: ' + err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Guardar'; }
  });
  document.getElementById('btn-add-usuario')?.addEventListener('click', () => openModal('modal-usuario'));
  document.getElementById('btn-cancel-usuario')?.addEventListener('click', () => closeModal('modal-usuario'));
}

// --- TABLE SEARCH ---
function setupTableSearches() {
  const searchIds = ['mis-solicitudes', 'cfo-bandeja', 'bancarizados', 'proveedores', 'bancos', 'servicios', 'sedes', 'usuarios'];
  searchIds.forEach(section => {
    const input = document.getElementById(`search-${section}`) as HTMLInputElement;
    const tbody = document.getElementById(`table-body-${section}`);
    if (!input || !tbody) return;
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(row => {
        if (q === '') { row.style.display = ''; return; }
        const text = row.textContent?.toLowerCase() || '';
        row.style.display = text.includes(q) ? '' : 'none';
      });
    });
  });
}

// --- FILE DROPZONES ---
function setupDropzones() {
  setupFileDropzone('dropzone-solicitud', 'file-input-solicitud', 'dropzone-browse-solicitud', 'file-list-solicitud', { files: solicitudFiles }, renderArchivosEditables);
  setupFileDropzone('dropzone-bancarizar', 'file-input-bancarizar', 'dropzone-browse-bancarizar', 'file-list-bancarizar', { files: bancarizarFiles });
}

// --- INIT ---
function setupSidebar() {
  const s = document.getElementById('sidebar');
  if (!s) return;
  s.addEventListener('mouseenter', () => s.classList.add('expanded'));
  s.addEventListener('mouseleave', () => s.classList.remove('expanded'));
}

function init() {
  setupSidebar();
  setupNavigation();
  setupEventListeners();
  setupTableSearches();
  setupDropzones();
  verificarSesion();
  console.log('BancaFlow v2 Renderer initialized');
}

init();
