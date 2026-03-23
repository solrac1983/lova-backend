// Supabase Edge Function: send-prompt
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
            };

            const PROMPTX_GATEWAY_URL = Deno.env.get("PROMPTX_GATEWAY_URL") || "";
            const PROMPTX_ANON_KEY = Deno.env.get("PROMPTX_ANON_KEY") || "";
            const PROMPTX_LICENSE_KEY = Deno.env.get("PROMPTX_LICENSE_KEY") || "";
            const PROMPTX_DEVICE_ID = Deno.env.get("PROMPTX_DEVICE_ID") || "";
            const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
            const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

            Deno.serve(async (req) => {
                if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
                    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
                        try {
                                const body = await req.json();
                                        const { message, projectId, token, files } = body;
                                                const response = await fetch(PROMPTX_GATEWAY_URL, {
                                                            method: "POST",
                                                                        headers: {
                                                                                        "Content-Type": "application/json",
                                                                                                        "apikey": PROMPTX_ANON_KEY,
                                                                                                                        "Authorization": `Bearer ${PROMPTX_ANON_KEY}`,
                                                                                                                                    },
                                                                                                                                                body: JSON.stringify({
                                                                                                                                                                action: "proxy_webhook",
                                                                                                                                                                                licenseKey: PROMPTX_LICENSE_KEY,
                                                                                                                                                                                                deviceId: PROMPTX_DEVICE_ID,
                                                                                                                                                                                                                sessionToken: "",
                                                                                                                                                                                                                                payload: { message, projectId, token, files: files || [] },
                                                                                                                                                                                                                                            }),
                                                                                                                                                                                                                                                    });
                                                                                                                                                                                                                                                            const data = await response.json();
                                                                                                                                                                                                                                                                    return new Response(JSON.stringify(data), {
                                                                                                                                                                                                                                                                                headers: { ...corsHeaders, "Content-Type": "application/json" },
                                                                                                                                                                                                                                                                                        });
                                                                                                                                                                                                                                                                                            } catch (error) {
                                                                                                                                                                                                                                                                                                    return new Response(JSON.stringify({ error: error.message }), {
                                                                                                                                                                                                                                                                                                                status: 500,
                                                                                                                                                                                                                                                                                                                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                                                                                                                                                                                                                                                                                                                                    });
                                                                                                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                                                                                        });
                                                                                                                                                                                                                                                                                                                                        
