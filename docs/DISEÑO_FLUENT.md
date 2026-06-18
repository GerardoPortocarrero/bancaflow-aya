# Guía de Estándares de Diseño: Dark Glassmorphism Premium (BancaFlow)

Este documento inmortaliza las reglas de ingeniería visual, tokens de diseño y buenas prácticas seguidas en la **Fase 1** para lograr una interfaz translúcida de alta fidelidad bajo el motor **Acrylic de Windows 11**. Cualquier vista posterior (Login, Tablas, Modales) debe adherirse estrictamente a este documento.

---

## 1. Reglas de Oro del Glassmorphism (Efecto Cristal)

*   **Fondo del Dominio Web Transparente (Regla Madre):** El motor Chromium de Electron jamás debe pintar un fondo sólido. La etiqueta `html` y `body` deben poseer `background: transparent !important`.
*   **Capas Ahumadas y Desenfoque Profundo:** Las tarjetas no deben ser blancas ni negras puras opacas. Deben usar fondos translúcidos oscuros con un canal alfa sutil y un desenfoque alto (`backdrop-filter: blur(35px) a(40px)`).
*   **Bordes de Reflexión Física (Efecto Contorno):** Para que un contenedor de cristal se distinga en fondos claros u oscuros, debe poseer un borde delgado blanco semi-transparente de baja opacidad (`rgba(255, 255, 255, 0.08)`). Esto simula el reflejo de la luz física sobre las aristas del cristal.

---

## 2. Tokens de Diseño y Clases (Tailwind v4 Setup)

### 🎨 Paleta Temática
*   **Fondo de Aplicación:** `transparent` (Hereda el Acrílico del sistema operativo).
*   **Sidebar (Mica Effect):** `rgba(15, 15, 15, 0.4)` con `backdrop-blur(40px)`.
*   **Tarjetas (`fluent-card`):** `rgba(30, 30, 30, 0.55)` con `backdrop-blur(40px)`.
*   **Bordes de Control:** `rgba(255, 255, 255, 0.07)`.
*   **Color de Acento (Contraste):** Celeste Eléctrico de Windows Fluent (`#60cdff`) para enlaces activos y realces.

### ✍️ Tipografía y Contraste de Fuentes (Anti-Invisibilidad)
Debido a que el acrílico asume tonalidades oscuras de fondo, **se prohíbe el uso de textos negros o grises oscuros**.
*   **Textos Principales / Títulos:** Blanco Puro (`text-white`), peso `font-bold` o `font-extrabold`.
*   **Textos Secundarios / Etiquetas:** Gris Claro Neón (`text-slate-200` o `text-slate-300`), peso mínimo `font-medium` o `font-semibold`.
*   **Métricas Monetarias:** Verde Esmeralda de Alto Brillo (`text-emerald-400`) para que resalte inmediatamente sin fatiga visual.

---

## 3. Integración con el Sistema Operativo (Windows 11)

### 🪟 Configuración de la Ventana (`main.ts`)
```typescript
transparent: true,
vibrancy: 'sidebar',          // Fuerza el blending de Chromium con el fondo
backgroundMaterial: 'acrylic'  // Activa el algoritmo Acrylic premium traslúcido
```

### 📐 Geometría y Zonas de Exclusión (`-`, `▢`, `×`)
Al utilizar `titleBarStyle: 'hidden'`, la barra de título desaparece y los botones de control de Windows flotan sobre el HTML en la esquina superior derecha.
*   **Margen de Seguridad (Header):** Todo header o barra superior debe poseer un relleno obligatorio a la derecha de mínimo **`pr-[140px]`**. Esto blinda el espacio de los botones y evita que colisionen con los botones de la app.
*   **Relleno de Sidebar:** Debe iniciar con un relleno superior de **`pt-10`** para no quedar pegado al borde del marco.
*   **Arrastre de Ventana:** Se utiliza la propiedad CSS `-webkit-app-region: drag` para las zonas movibles (`.drag-region`), y obligatoriamente `-webkit-app-region: no-drag` (`.no-drag`) para elementos cliqueables (botones, inputs, enlaces) dentro de dicha zona.
