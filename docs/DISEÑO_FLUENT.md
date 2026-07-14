# Guía de Estándares de Diseño: Dark Glassmorphism Premium (BancaFlow)

Este documento inmortaliza las reglas de ingeniería visual, tokens de diseño y buenas prácticas para lograr una interfaz translúcida de alta fidelidad bajo el motor **Acrylic de Windows 11**.

---

## 1. Reglas de Oro del Glassmorphism (Efecto Cristal)

* **Fondo del Dominio Web Transparente (Regla Madre):** El motor Chromium de Electron jamás debe pintar un fondo sólido. La etiqueta `html` y `body` deben poseer `background: transparent !important`.
* **Capas Ahumadas y Desenfoque Profundo:** Las tarjetas no deben ser blancas ni negras puras opacas. Deben usar fondos translúcidos oscuros con un canal alfa sutil y un desenfoque alto (`backdrop-filter: blur(35px) a(40px)`).
* **Bordes de Reflexión Física (Efecto Contorno):** Para que un contenedor de cristal se distinga en fondos claros u oscuros, debe poseer un borde delgado blanco semi-transparente de baja opacidad (`rgba(255, 255, 255, 0.08)`).

---

## 2. Tokens de Diseño y Clases (Tailwind v4 Setup)

### Paleta Temática
* **Fondo de Aplicación:** `transparent` (Hereda el Acrílico del sistema operativo).
* **Sidebar (Mica Effect):** `rgba(15, 15, 15, 0.4)` con `backdrop-blur(40px)`.
* **Tarjetas (`fluent-card`):** `rgba(30, 30, 30, 0.55)` con `backdrop-blur(40px)`.
* **Bordes de Control:** `rgba(255, 255, 255, 0.07)`.
* **Color de Acento (Contraste):** Celeste Eléctrico de Windows Fluent (`#60cdff`).

### Tipografía y Contraste de Fuentes
* **Textos Principales / Títulos:** Blanco Puro (`text-white`), peso `font-bold` o `font-extrabold`.
* **Textos Secundarios / Etiquetas:** Gris Claro Neón (`text-slate-200` o `text-slate-300`), peso mínimo `font-medium`.
* **Métricas Monetarias:** Verde Esmeralda de Alto Brillo (`text-emerald-400`).

---

## 3. Integración con el Sistema Operativo (Windows 11)

### Configuración de la Ventana (`main.ts`)
```typescript
transparent: true,
vibrancy: 'sidebar',
backgroundMaterial: 'acrylic'
```

### Geometría y Zonas de Exclusión (minimizar, ▢, cerrar)
Al utilizar `titleBarStyle: 'hidden'`, la barra de título desaparece y los botones de control de Windows flotan sobre el HTML en la esquina superior derecha.
* **Margen de Seguridad (Header):** El header debe tener padding derecho de **`pr-[150px]`** para evitar colisión con los botones nativos de ventana.
* **Altura del Header:** **`h-[40px]`** (coincide con la altura del `titleBarOverlay`).
* **Relleno de Sidebar:** Debe iniciar con **`pt-10`** para alinear con el header.
* **Arrastre de Ventana:** `.drag-region` (`-webkit-app-region: drag`) para zonas movibles. `.no-drag` (`-webkit-app-region: no-drag`) para elementos cliqueables dentro de dichas zonas.

---

## 4. Patrones de UI Implementados

### 4.1 Secciones con `mica-section`
Las vistas principales usan `mica-section` en lugar de `fluent-card` envolvente:
- Fondo glass (oscuro semitransparente con blur).
- Bordes redondeados (`rounded-xl`).
- La tabla va de borde a borde dentro de la sección (sin padding extra en el contenedor de la tabla).

### 4.2 Tablas (`table-fixed` + `colgroup`)
```html
<table class="w-full text-left text-sm text-slate-300 table-alternate table-fixed">
    <colgroup>
        <col style="width:11%">
        <col style="width:27%">
        ...
    </colgroup>
</table>
```
- `table-fixed` + `<colgroup>` con anchos porcentuales evita scroll horizontal.
- Celdas truncadas con `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` (excepto columna Acción).
- Clase `table-alternate` para filas alternadas sutiles.

### 4.3 Botones de Acción en Tablas
Iconos Lucide compactos dentro de pills semánticas:
```html
<button class="p-1.5 rounded-lg bg-fluent-accent/15 text-fluent-accent hover:bg-fluent-accent/25 transition-colors" title="Editar">
    <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
</button>
```
| Acción | Color | Icono |
|--------|-------|-------|
| Editar | `bg-fluent-accent/15` | `pencil` |
| Eliminar | `bg-red-500/15` | `trash-2` |
| Bancarizar | `bg-emerald-500/15` | `banknote` |
| Observar | `bg-red-500/15` | `x-circle` |
| Ver detalle | `bg-white/10` | `eye` |

### 4.4 Toolbar Compacto
Buscador + botón "Añadir" en una sola fila:
```html
<div class="flex items-center gap-3 px-8 py-3 border-b ...">
    <input type="text" ... placeholder="Buscar..." class="fluent-input text-xs flex-1 min-w-0">
    <button class="text-xs font-bold uppercase ... shrink-0 whitespace-nowrap">Añadir</button>
</div>
```

### 4.5 Sistema de Toasts
Notificaciones animadas que reemplazan `alert()`:
- Posición: `fixed bottom-4 right-4` (`.toast-container`).
- Tipos: `success` (verde), `error` (rojo), `warning` (ámbar), `info` (azul).
- Animación: slide-in desde abajo + fade-in.
- Auto-destrucción después de mostrar.

### 4.6 Modales Animados
```typescript
function openModal(id: string) {
    modal.classList.remove('hidden');
    modal.querySelector('.modal-content')?.classList.add('modal-in');
    // primer input autofocus
}
function closeModal(id: string) {
    modal.classList.add('hidden');
}
```
- Animación de entrada: `modal-in` (scale + fade).
- Cierre con tecla **Escape** y click en **backdrop**.
- Auto-foco en el primer input al abrir.

### 4.7 Diálogo de Confirmación
```typescript
async function confirmDialog(mensaje: string): Promise<boolean>
```
- Overlay estilizado consistente con el tema.
- Botones: Confirmar (danger) / Cancelar.
- Reemplaza `confirm()` nativo.

### 4.8 Skeleton Loading
```typescript
function skeletonRows(tbodyId: string, cols: number)
```
- Muestra 5 filas de esqueleto con shimmer animation.
- Se llama antes de cada carga de datos.
- Se elimina al insertar los datos reales.

### 4.9 Scrollbar Personalizada
```css
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 3px;
}
```

### 4.10 Dashboard Stat Cards
Cards con icono Lucide + label + valor numérico:
- `Pendiente Revisión` (icono `clock`, ámbar).
- `Por Bancarizar` (icono `send`, acento celeste).
- `Bancarizados Hoy` (icono `circle-check`, esmeralda).

### 4.11 Auto-refresh
Las vistas activas se recargan automáticamente cada 10 segundos:
- `setInterval(cargarVistaActiva, 10000)`.
- Al cambiar de pestaña (nav-link), se forza recarga inmediata.
- El intervalo se limpia al hacer logout.
