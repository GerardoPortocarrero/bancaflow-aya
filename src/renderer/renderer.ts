// @ts-ignore
const { createIcons, LayoutDashboard, FilePlus, History, Bell, Settings, LogOut } = lucide;

// Inicializar iconos
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

// Lógica de Navegación Simple (SPA)
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

        // Cambiar sección
        sections.forEach(section => {
            if (section.id === targetId) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });
    });
});

// Lógica de Detracciones (Regla: > 700 Soles)
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

console.log('BancaFlow Renderer Initialized');
