import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- CONFIGURACIÓN ---
// REEMPLAZAR ESTA URL POR LA URL PÚBLICA REAL DE TU LOGO
const LOGO_URL = "https://ucysuqqcnbsatfaghaaq.supabase.co/storage/v1/object/public/assets/Logo%20OCME.png";
// Color primario de la marca (Naranja Automat)
const BRAND_COLOR = "#e85d04";

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { email, clientName, debtDetails } = await req.json();

        // Validations
        if (!email) throw new Error("Email is required");

        console.log(`Sending email to ${clientName} (${email})`);

        // Build Invoices Table Rows
        const invoices = debtDetails.invoices || [];

        const tableRows = invoices.map((inv: any) => {
            // Estilo basado en antigüedad (semáforo)
            let delayColor = "#166534"; // verde
            if (inv.days > 30) delayColor = "#854d0e"; // amarillo/naranja
            if (inv.days > 60) delayColor = "#991b1b"; // rojo

            return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px; font-size: 12px; color: #374151;">${inv.number}</td>
            <td style="padding: 8px; font-size: 12px; color: #374151;">${new Date(inv.date).toLocaleDateString()}</td>
            <td style="padding: 8px; font-size: 12px; font-weight: bold; color: ${delayColor}; text-align: center;">
                ${inv.days > 0 ? inv.days + ' días' : 'Al día'}
            </td>
            <td style="padding: 8px; font-size: 12px; font-family: monospace; text-align: right;">
                ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(inv.amount)}
            </td>
        </tr>
        `;
        }).join("");

        const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: sans-serif; color: #1f2937; line-height: 1.5; margin: 0; padding: 0; background-color: #f3f4f6; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background-color: #ffffff; padding: 20px; text-align: center; border-bottom: 3px solid ${BRAND_COLOR}; }
          .content { padding: 30px 20px; }
          .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
          .btn { display: inline-block; padding: 10px 20px; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px; }
          .total-box { background-color: #fff7ed; border: 1px solid #fed7aa; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { font-size: 11px; text-transform: uppercase; color: #6b7280; padding: 8px; text-align: left; border-bottom: 1px solid #d1d5db; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- HEADER WITH LOGO -->
          <div class="header">
            <img src="${LOGO_URL}" alt="OCME Logo" width="160" style="display: block; margin: 0 auto;" />
          </div>

          <!-- BODY -->
          <div class="content">
            <h2 style="color: #111827; margin-top: 0;">Aviso de Estado de Cuenta</h2>
            <p>Estimados <strong>${clientName}</strong>,</p>
            <p>Adjuntamos el detalle de las facturas pendientes a la fecha. Agradecemos su gestión para regularizar el saldo.</p>
            
            <div class="total-box">
                <span style="font-size: 14px; color: #9a3412; display: block;">Saldo Total Pendiente</span>
                <strong style="font-size: 24px; color: ${BRAND_COLOR};">${debtDetails.totalFormatted}</strong>
            </div>

            <p style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">Detalle de Comprobantes:</p>
            <table>
                <thead>
                    <tr>
                        <th>Número</th>
                        <th>Fecha</th>
                        <th style="text-align: center;">Antigüedad</th>
                        <th style="text-align: right;">Importe</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>

            <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
                Si ya realizó el pago, por favor desestime este aviso o envíenos el comprobante para actualizar nuestra cuenta corriente.
            </p>
          </div>

          <!-- FOOTER -->
          <div class="footer">
            <p>OCME S.A.</p>
            <p>Este es un correo automático, por favor no responder directamente si no es necesario.</p>
          </div>
        </div>
      </body>
      </html>
    `;

        const data = await resend.emails.send({
            from: "Cobranzas OCME <cobranzas@ocme.com.ar>", // Corregido: Dominio del negocio (OCME)
            to: [email],
            subject: `OCME - Estado de Cuenta ${clientName}`,
            html: emailHtml,
        });

        console.log("Email sent result:", data);

        return new Response(
            JSON.stringify({ success: true, data, debug_invoices_count: invoices.length }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error sending email:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 } // Return 200 to handle error in frontend gracefully
        );
    }
});
