# Documentación Oficial del Sistema: BancaFlow
**Proceso:** Gestión Centralizada de Bancarización  
**Costo de Infraestructura:** $0 USD (100% Gratis)  
**Tipo de Aplicación:** Escritorio Nativo (`.exe` para Windows vía Electron)  

---

## 1. Contexto del Problema y de la Solución

### 🚨 El Problema (El Caos Actual)
El flujo administrativo actual de la empresa sufre de "islas de información" y una grave falta de control centralizado. Los departamentos de **RRHH**, **Administración** y **Contabilidad** generan solicitudes de pago que se envían al **CFO (Gerente de Finanzas)** de manera informal mediante chats de WhatsApp o compartiéndose un archivo Excel local que cambia de manos constantemente.

Este desorden operativo genera tres riesgos críticos para el negocio:
* **Pérdida de trazabilidad:** No existe un registro histórico fiable de quién solicitó un pago, cuándo fue aprobado por el CFO o si realmente se llegó a bancarizar.
* **Vulnerabilidad fiscal (Detracciones):** Al procesar los montos de forma manual y visual, existe un alto riesgo humano de omitir el depósito de la detracción cuando un servicio supera los **700 Soles**, lo que expone a la empresa a multas y sanciones por parte de la SUNAT.
* **Desorden documentario:** Los sustentos digitales (archivos XML, PDFs de facturas y capturas de pantalla de las transferencias) quedan dispersos en computadoras individuales o se pierden en el historial de WhatsApp.

### 💡 La Solución (El Estado Ideal con BancaFlow)
**BancaFlow** es una aplicación de escritorio centralizada que unifica todo el proceso bajo un único software. Cada área accede al sistema con un rol específico. La información y los documentos ya no viajan por canales informales; ahora se almacenan de forma segura en una base de datos en la nube de forma automática. 

El sistema automatiza la lógica de negocio (como el cálculo y la alerta obligatoria de detracciones), reduce el peso de los archivos antes de subirlos para optimizar el espacio, y restringe el cierre de los flujos hasta que el CFO adjunte los reportes bancarios correspondientes. El resultado es la eliminación absoluta de los mensajes de coordinación y los Excels diarios.

---

## 2. Arquitectura del Sistema

El sistema adopta una arquitectura **Cliente-Servidor (Serverless)** híbrida, optimizada para operar a costo cero y garantizar almacenamiento masivo por más de una década sin necesidad de servidores locales de pago.

              +-----------------------------------+
              |    BancaFlow.exe (Electron + TS)  |
              +-----------------------------------+
                /                               \
 (Envía Archivo /                                \ (Guarda Datos y Link
  Usa Token .json)                                \ de Drive de forma segura)
              v                                  v
+-----------------------------+            +----------------------------+
| Google Drive (Carpeta)      |            | Supabase SQL (Postgres)    |
| - Almacena PDFs e Imágenes  |            | - Guarda: ID, Monto,       |
| - Capacidad: 15 GB ($0)     |            |   Estado, Link de Drive    |
+-----------------------------+            +----------------------------+


### Descripción de los Componentes:
1.  **Cliente Desktop (BancaFlow App):** Aplicación nativa para Windows desarrollada con **Electron** y **TypeScript**, compilada en un único archivo ejecutable portable. Utiliza tecnologías web (HTML/CSS/JS) para la interfaz pero con acceso total al sistema de archivos local.
2.  **Capa de Autenticación y Datos (Supabase SQL):** Base de datos relacional (PostgreSQL) en la nube que gestiona el acceso de los usuarios mediante el SDK oficial de Supabase para JavaScript/TypeScript.
3.  **Capa de Almacenamiento Masivo (Google Drive API via Cuenta de Servicio):** Espacio centralizado de 15 GB gestionado mediante la librería `googleapis` en Node.js.

---

## 3. Tecnologías y su Uso (Costo $0)

Para garantizar un desarrollo robusto sin costos de licenciamiento ni suscripciones mensuales, se seleccionó el siguiente ecosistema de código abierto y capas gratuitas (*free-tiers*):

| Tecnología | Rol en el Sistema | Justificación de Costo $0 |
| :--- | :--- | :--- |
| **Electron** | Framework para aplicaciones de escritorio. | Código abierto, permite usar el motor de Chrome para una interfaz fluida y fácil de compilar a `.exe`. |
| **TypeScript** | Lenguaje de programación principal. | Superconjunto de JavaScript que añade tipos estáticos, evitando errores comunes en el manejo de montos y estados financieros. |
| **Supabase SDK** | Gestión de base de datos y autenticación. | SDK oficial para JS/TS. El plan gratuito incluye **500 MB** de base de datos relacional. |
| **Google Drive API (`googleapis`)** | Almacenamiento en la nube para documentos pesados. | Proporciona **15 GB** de almacenamiento gratuito mediante una cuenta de servicio. |
| **Sharp** | Procesamiento y compresión extrema de imágenes. | Librería de Node.js ultra rápida para convertir capturas a WebP/JPEG optimizado. |
| **PDF-Lib** | Manipulación y optimización de archivos PDF. | Permite procesar PDFs en el cliente antes de subirlos. |
| **Electron Builder** | Empaquetado a ejecutable portable. | Herramienta que genera el `.exe` único que no requiere instalación. |

---

## 4. Estrategia de Compresión y Optimización de Archivos

Para maximizar los 15 GB de Google Drive y garantizar un rendimiento inmediato al abrir documentos, el sistema `BancaFlow.exe` procesará localmente cada archivo antes de subirlo a la nube:

* **Para Imágenes (Capturas de pantalla de bancos/recibos):** El sistema utilizará la librería **Sharp** para convertir la imagen a formato **WebP**, reduciendo la resolución y calidad significativamente. Objetivo: ~10KB a 50KB por imagen.
* **Para PDFs:** El sistema procesará los PDFs para eliminar metadatos innecesarios y optimizar el contenido mediante **pdf-lib**, asegurando que el espacio de 15 GB sea suficiente para años de operación.

---

## 5. Requerimientos del Sistema

### Requerimientos Funcionales (RF)

#### 🔑 Gestión de Usuarios y Accesos
* **RF1.1:** El sistema deberá permitir el inicio de sesión mediante credenciales únicas (correo y contraseña) usando la autenticación de Supabase.
* **RF1.2:** El sistema deberá validar y restringir las pantallas y opciones según el rol asignado (**RRHH**, **Administrador**, **Contador**, **CFO**).

#### 📝 Flujo de Solicitudes (RRHH / Administrador / Contador)
* **RF2.1:** El usuario solicitante deberá poder registrar una nueva petición de pago completando: Proveedor, Descripción del servicio/suministro, Monto (en Soles) y adjuntando el sustento digital (XML, PDF o captura).
* **RF2.2:** **[Compresión en Origen]:** Antes de subir cualquier archivo adjunto, el sistema (vía Node.js/Sharp) deberá procesar el archivo localmente para reducir su peso al mínimo técnico legible.
* **RF2.3:** **[Regla de Negocio Crítica]:** Al ingresar el monto, si este es mayor a **700 Soles**, BancaFlow deberá marcar automáticamente la solicitud con la etiqueta interna e informativa: `Requiere Detracción = SÍ`.

#### 📊 Panel de Revisión y Aprobación (CFO)
* **RF3.1:** El CFO deberá visualizar un tablero centralizado con todas las solicitudes que se encuentren en estado `Pendiente de Revisión`.
* **RF3.2:** **[Visualización Integrada]:** El CFO deberá poder previsualizar de forma nativa la imagen o el PDF adjunto dentro de la misma interfaz de Electron.
* **RF3.3:** El CFO deberá tener la facultad de `Aprobar` o `Rechazar` la solicitud. En caso de rechazo, el sistema obligará a escribir el motivo.

#### 🏦 Proceso de Bancarización (CFO)
* **RF4.1:** Para las solicitudes aprobadas, el CFO podrá cambiar el estado a `Bancarizado` una vez realizada la transferencia real en el banco.
* **RF4.2:** **[Bloqueo de Seguridad]:** El sistema no permitirá cambiar el estado a `Bancarizado` a menos que el CFO adjunte obligatoriamente el comprobante de transferencia bancaria y la constancia de depósito de detracción si corresponde.

#### 📈 Consultas y Reportes
* **RF5.1:** El sistema permitirá a todos los roles visualizar el historial de transacciones en tiempo real.
* **RF5.2:** El sistema contará con un botón para **Exportar a Excel**, usando librerías como `exceljs` en Node.js.

---

### Requerimientos No Funcionales (RNF)

* **RNF1 (Costo Cero):** El costo total de infraestructura debe ser de **0 USD** permanentemente.
* **RNF2 (Cero Instalaciones):** La aplicación debe distribuirse como un único archivo ejecutable portable (`BancaFlow.exe`). El usuario final no requerirá instalar Node.js ni otros entornos.
* **RNF3 (Seguridad de Datos y Llaves):** Las credenciales de la API de Google Drive y Supabase deben manejarse de forma segura, preferiblemente encriptadas o inyectadas durante el proceso de compilación del `.exe`.
* **RNF4 (Robustez de Tipos):** Se utilizará **TypeScript** para garantizar que los cálculos financieros y los estados de flujo sean consistentes y libres de errores de tipo en tiempo de ejecución.
* **RNF5 (Portabilidad Local):** La aplicación cliente se ejecutará de forma nativa en sistemas operativos Windows 10 y Windows 11.