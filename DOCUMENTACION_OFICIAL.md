# Documentación del Proyecto: Dashboard Comercial OCME

**Versión del Documento:** 1.0
**Fecha:** 30 de Enero, 2026
**Estado:** Final / Producción

---

## 1. Descripción General del Proyecto

### ¿Qué es?
La aplicación es un **Dashboard de Inteligencia Comercial** diseñado específicamente para OCME. Funciona como una herramienta de visualización y control que transforma archivos de Excel (cotizaciones, ventas y estados de cuenta) en tableros interactivos con indicadores clave, gráficos de tendencia y alertas de deuda.

### ¿Para qué se creó?
Se creó para eliminar la dependencia de la revisión manual de múltiples hojas de cálculo. Antes, obtener una "foto" del estado de la empresa requería cruzar datos mentalmente o con fórmulas complejas. Ahora, el sistema centraliza esa información en una sola pantalla.

### ¿Qué problemas resuelve?
*   **Visibilidad:** Permite ver instantáneamente cuánto se vendió, cuánto se debe y quiénes son los principales deudores.
*   **Unificación:** Consolida datos de diferentes archivos (Ventas vs. Cobranzas) que a menudo tienen nombres de clientes escritos de forma distinta.
*   **Control de Errores:** Detecta automáticamente discrepancias entre la deuda calculada y la deuda reportada en los Excel (Auditoría).

---

## 2. Arquitectura General (Conceptual)

### Tipo de Aplicación
Es una **Single Page Application (SPA)** moderna, alojada en la nube (Vercel).
*   **No requiere instalación:** Se accede desde cualquier navegador web.
*   **Procesamiento Local:** La inteligencia ocurre en tu computadora. Cuando subes un archivo, el procesamiento de datos se realiza en tu navegador, garantizando velocidad y privacidad inmediata.

### Flujo de Información
1.  **Datos Crudos (Input):** El usuario carga los archivos Excel (`Ventas.xlsx`, `Clientes.xlsx`).
2.  **Procesamiento (La "Caja Negra"):** El sistema lee los archivos, normaliza nombres (ej: "OCME SA" = "OCME S.A."), convierte monedas y calcula totales.
3.  **Persistencia Local:** Los datos procesados se guardan temporalmente en la memoria del navegador (`LocalStorage`) para que no tengas que subir los archivos cada vez que recargas la página.
4.  **Visualización (Output):** Se generan los gráficos, tablas y tarjetas de KPI.

---

## 3. Gestión de Datos y Base de Datos

### Dónde se almacenan los datos
*   **Persistencia Local (Principal):** Los datos de negocio (montos, clientes, facturas) viven en tu navegador (`LocalStorage`). No se envían a una base de datos central en la nube. Esto significa que si cambias de computadora, deberás volver a cargar los Excel.
*   **Base de Datos en Nube (Supabase):** Se utiliza **únicamente** para gestionar usuarios y permisos (quién puede loguearse).

### Reglas Clave
*   **Fuente Única de Verdad:** Los archivos Excel son la autoridad. Si el sistema muestra un dato erróneo, el error está casi siempre en el Excel de origen.
*   **Limpieza Previa:** Al subir nuevos archivos, el sistema reemplaza la información anterior del mismo tipo (ej: si subes un nuevo Excel de Ventas, borra las ventas viejas y pone las nuevas). No acumula histórico infinito, muestra la "foto" del momento.

---

## 4. Fuentes de Información

El sistema se alimenta de dos archivos Excel críticos:

1.  **Seguimiento de Cotizaciones y Ventas:**
    *   Contiene: Operaciones comerciales, fechas, montos y estados (Ganada, Perdida, Abierta).
    *   Regla Crítica: Debe tener columnas de fecha válidas y montos numéricos.

2.  **Estado de Cuenta de Clientes:**
    *   Contiene: El detalle de deuda por cliente (facturas impagas).
    *   Regla Crítica: Se busca una celda específica llamada **"TOTAL DEUDA"** para la auditoría.

### Interpretación de Datos
*   **Monedas:** El sistema detecta automáticamente ARS y USD, unificándolos a una moneda base para los totales (o mostrándolos separados según el módulo).
*   **Fechas:** Entiende el formato argentino (`dd/mm/aaaa`).

---

## 5. Módulos de la Aplicación

### A. Dashboard Principal (Ventas)
*   **Muestra:** Tendencias de facturación mensual, tasa de conversión (cotizaciones ganadas vs totales) y embudo de ventas.
*   **Origen:** Excel de Cotizaciones/Ventas.
*   **Decisión:** ¿Estamos vendiendo más que el mes pasado? ¿Qué eficacia tenemos cerrando tratos?

### B. Estado de Clientes (Cobranzas)
*   **Muestra:** Ranking de deudores, antigüedad de la deuda (Aging) y detalle por cliente.
*   **Origen:** Excel de Estados de Cuenta.
*   **Decisión:** ¿A quién llamar hoy para cobrar? ¿Qué porcentaje de la deuda es crítica (+60 días)?

### C. Auditoría y Control
*   **Muestra:** Alertas visuales sobre la calidad de los datos.
*   **Función:** Compara el cálculo matemático del sistema contra el "TOTAL DEUDA" escrito en el Excel.

---

## 6. Auditoría y Control de Consistencia

El sistema tiene un "Auditor Virtual" que revisa cada cliente:

*   **Ícono ✔ (Verde/Gris):** **Consistente.** La suma de las facturas que leyó el sistema coincide exactamente (con una tolerancia de 0.1 centavos) con el total que dice el Excel. Puedes confiar en el dato.
*   **Ícono ❗ (Rojo):** **Discrepancia.** La suma de las facturas NO coincide con el total del Excel.
    *   *Causa probable:* Hay facturas ocultas en el Excel, celdas con formato de texto en lugar de número, o errores de fórmula en el archivo original.
    *   *Acción:* Revisar el Excel de ese cliente específico.

---

## 7. Integraciones Externas

*   **GitHub:** Es la "caja fuerte" del código. Guarda todas las versiones del programa. Si un cambio rompe algo, se puede "volver atrás" desde aquí.
*   **Vercel:** Es el "hosting". Se encarga de construir la aplicación y hacerla visible en internet (`dashboard.ocme.com.ar`). Se conecta con GitHub automáticamente.
*   **Supabase:** Es el "portero". Gestiona el login seguro. Verifica que el email y contraseña sean correctos antes de dejar entrar a nadie.
*   **DNS (Domain Name System):** Conecta tu dominio `ocme.com.ar` con los servidores de Vercel.

---

## 8. Usuarios, Accesos y Credenciales

*   **Tipo de Login:** Correo electrónico y contraseña.
*   **Gestión:** Se realiza a través del panel de Supabase. Allí se pueden invitar nuevos usuarios o revocar accesos.
*   **Seguridad:** Las contraseñas no las conoce nadie (ni los desarrolladores), están encriptadas en Supabase.
*   **Datos Sensibles:** Las claves API (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) conectan la app con el servicio de usuarios. Estas NO deben compartirse públicamente.

---

## 9. Backups y Recuperación

*   **Código:** El backup del sistema está en GitHub. Es indulgente a fallos de PC local.
*   **Datos:** Como los datos viven en los Excel y en el navegador, **tu backup son tus archivos Excel**. Si la aplicación se "rompe" o borras el historial del navegador, simplemente vuelves a subir tus Excel y todo se restaura en segundos.

---

## 10. Riesgos y Consideraciones Futuras

*   **Dependencia del Formato Excel:** El sistema está programado para leer una estructura específica de columnas. Si mañana cambias drásticamente el diseño de tus Excel (ej: cambias el nombre de la columna "Importe" por "Monto Total"), el sistema podría dejar de leerlo.
    *   *Mitigación:* Intentar mantener los formatos estables.
*   **Volumen de Datos:** Al ser procesamiento local en navegador, si intentas cargar un Excel con 500,000 filas, el navegador podría ponerse lento. El sistema está optimizado para volúmenes comerciales normales (miles de filas).

---

## 11. Glosario Funcional (KPIs)

Guía rápida para entender los números:

*   **Ingresos Totales (Revenue):** Suma bruta de todas las notas de venta marcadas como "Cerradas/Ganadas".
*   **Tasa de Conversión:** De cada 10 cotizaciones que enviamos, ¿cuántas se transforman en venta? (Ej: 30% = de 10 cerramos 3).
*   **Deuda Total:** La suma de todo el dinero que los clientes deben a la empresa hoy.
*   **Deuda Vencida:** Dinero que deberían habernos pagado hace tiempo (fecha de vencimiento ya pasó).
*   **Deuda Corriente:** Dinero que nos deben, pero cuya fecha de pago aún no ha llegado (está "en fecha").
*   **Top Deudores:** Los clientes que acumulan el 80% de la deuda total (Ley de Pareto). Son la prioridad de gestión.
*   **Días en la Calle (DSO - implícito):** Antigüedad promedio de la deuda. Ayuda a saber si estamos cobrando rápido o lento.

---
---

## 12. Guía de Mantenimiento (Para Desarrolladores)

Si en el futuro necesitas realizar modificaciones técnicas, esta guía te indica dónde buscar:

### Diseño y Apariencia
*   **Colores, fuentes y estilos globales:** `src/index.css` y `tailwind.config.js`.
*   **Cambiar la disposición de elementos (Gráficos, Tarjetas):** `src/App.jsx` (aquí reside la estructura principal del Dashboard).
*   **Componentes Reutilizables:** `src/components/` (Buscadores, Filtros, Tablas).

### Lógica de Negocio (Excel)
*   **Lectura y validación de archivos:** `src/services/ExcelParser.js`. Aquí se configuran las columnas esperadas y la limpieza inicial.
*   **Cálculos y KPIs:** `src/services/DataProcessor.js`. Aquí están las fórmulas de Deuda, Ventas, Conversión, etc.
*   **Unificación de Nombres:** `src/services/ClientUnification.js`. Lógica para detectar que "Cliente SA" es lo mismo que "Cliente S.A.".

### Sistema
*   **Login y Usuarios:** `src/services/supabaseClient.js` y `src/context/AuthContext.jsx`.
*   **Configuración de Despliegue:** `vercel.json`.

---
*Fin del Documento - Elaborado por Antigravity*
