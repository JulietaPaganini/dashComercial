# Investigación de Mercado y Funcionalidades Clave (Pareto 80/20)

Este documento resume la investigación sobre aplicaciones líderes en dashboards de ventas y finanzas, identificando las funcionalidades críticas que aportan el mayor valor al usuario.

## 1. Referentes del Mercado (Competencia Conceptual)
Tu aplicación se posiciona en un punto medio estratégico: más específica que un Excel, pero más ágil que un BI corporativo.

*   **Geckoboard / Klipfolio:** Dashboards visuales enfocados en motivación y claridad instantánea.
*   **PowerBI / Tableau:** Potentes para análisis profundos, pero complejos de configurar.
*   **Módulos de Reportes CRM (HubSpot/Pipedrive):** Enfocados en el embudo de ventas y rendimiento del equipo.
*   **QuickBooks / Xero:** Enfocados en el flujo de caja (facturado vs. cobrado).

### ¿Qué tienen todos en común?
*   **Tarjetas de "Número Grande" (Big Number Cards):** Lo primero que ve el usuario son los totales absolutos (Total Vendido, Deuda Total).
*   **Semáforos Visuales:** Uso de colores universales (Verde = Meta/Bien, Rojo = Alerta/Mal) para interpretación rápida.
*   **Contexto Temporal Global:** Un filtro maestro de fecha que actualiza toda la pantalla simultáneamente.

---

## 2. El 20% de Funciones que da el 80% del valor
Para un dashboard de **Ventas, Cotizaciones y Deudas**, estas son las 4 áreas que definen el éxito del producto:

### A. Salud Financiera (El "Ahora")
*   **KPI Crítico:** Facturado vs. Cobrado.
*   **Visualización Clave:** Gráfico de antigüedad de deuda (Al día, 30 días, 60+ días).
*   **Valor:** Permite actuar inmediatamente sobre el flujo de caja.

### B. El Pipeline (El "Futuro")
*   **KPI Crítico:** Volumen total en cotizaciones abiertas.
*   **Visualización Clave:** Embudo de conversión o proyección simple (Si cierro mi promedio histórico, ¿cuánto dinero entra?).
*   **Valor:** Previsibilidad de ingresos a corto plazo.

### C. Top Clientes (Ley de Pareto Aplicada)
*   **KPI Crítico:** Quiénes son el 20% de clientes que generan el 80% de la facturación.
*   **Visualización Clave:** Ranking Top 10 Clientes (por venta y por deuda).
*   **Valor:** Foco estratégico. Saber a quién cuidar (VIPs) y a quién cobrar (Deudores).

### D. Detección de Anomalías (Gestión por Excepción)
*   **KPI Crítico:** Alertas de "Lo que no cuadra".
*   **Visualización Clave:** Listados simples de "Cotizaciones vencidas" o "Ventas grandes sin cobrar".
*   **Valor:** Ahorro de tiempo. El usuario no busca en todo el listado, el sistema le avisa dónde mirar.

---

## 3. Recomendación de Acción
Para la construcción del Dashboard "OCME", priorizar la implementación de estos 4 pilares antes de añadir funcionalidades complejas de filtrado o edición masiva.
