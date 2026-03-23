// Supabase Edge Function: send-prompt (Lovable Headless Bypass - Standalone)
// Substitui a dependencia do PromptX por um motor proprio usando OpenRouter + Lovable edit-code API.
// Versao Independente Local: nao checa banco de dados ou licencas.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// === CORS ===
const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

// === CONSTANTES ===
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

function jsonResponse(data: Record<string, unknown>, status = 200) {
            return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function errorResponse(message: string, status = 400) {
            return jsonResponse({ success: false, error: message }, status);
}

// === LOGICA DO HEADLESS BYPASS ===

async function getLovableSourceCode(projectId: string, token: string) {
            const res = await fetch(`https://api.lovable.dev/projects/${projectId}/source-code`, {
                            headers: { "Authorization": `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`Falha ao obter codigo-fonte do Lovable: ${res.status}`);
            const data = await res.json();
            return data.files || [];
}

async function applyLovableCodeEdits(projectId: string, token: string, changes: any[], commitMessage: string) {
            if (!changes || changes.length === 0) return true;

    const editUrl = `https://api.lovable.dev/projects/${projectId}/edit-code`;
            const payload = {
                            changes: changes,
                            uploads: [],
                            commit_message: commitMessage,
                            file_edit_type: "CodeEdit"
            };

    const res = await fetch(editUrl, {
                    method: "POST",
                    headers: {
                                        "Authorization": `Bearer ${token}`,
                                        "Content-Type": "application/json",
                                        "Accept": "application/json"
                    },
                    body: JSON.stringify(payload)
    });

    if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(`Falha ao aplicar edicoes: ${res.status} ${txt}`);
    }
            return true;
}

async function callOpenRouter(files: any[], userMessage: string) {
            let contextStr = "### CODIGO FONTE ATUAL DO PROJETO ###\n\n";
            for (const f of files) {
                            if (f.binary || f.sizeExceeded || !f.contents) continue;
                            if (f.name.includes("package-lock.json") || f.name.includes("bun.lockb")) continue;

                contextStr += `--- ARQUIVO: ${f.name} ---\n${f.contents}\n\n`;
            }

    const systemPrompt = `Voce e um Engenheiro de Software Senior especialista em React, TypeScript, Vite e Tailwind CSS.
        Voce esta trabalhando em um projeto (codigo fornecido abaixo).

            Instrucoes Criticas:
                1. O usuario fara um pedido de alteracao ou adicao no sistema.
                    2. Voce deve analisar os arquivos atuais e determinar quais arquivos precisam ser modificados ou criados.
                        3. Voce DEVE retornar EXCLUSIVAMENTE um objeto JSON valido (sem blocos Markdown json em volta, apenas o JSON texto puro).
                            4. O objeto JSON deve ter exatos dois campos:
                                   - "explanation": uma string em portugues explicando de forma amigavel ao usuario o que foi modificado e como testar. (Seja breve, no maximo 3 paragrafos).
                                             - "changes": um array de objetos. Cada objeto deve ter:
                                                              - "path": o caminho completo do arquivo (ex: "src/App.tsx")
                                                                                      - "content": TODO O CODIGO NOVO deste arquivo. NAO trunque, NAO use comentarios como "// resto do codigo". Voce DEVE fornecer o arquivo modificado por inteiro para ser salvo.`;

    console.log("[send-prompt] Chamando OpenRouter...");
            const ores = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                                                "Content-Type": "application/json",
                                                "HTTP-Referer": "https://lovable-infinity-panel.vercel.app",
                                                "X-Title": "Lovable Infinity"
                            },
                            body: JSON.stringify({
                                                model: "anthropic/claude-3.5-sonnet",
                                                messages: [
                                                        { role: "system", content: systemPrompt },
                                                        { role: "user", content: `${contextStr}\n\n### PEDIDO DO USUARIO ###\n${userMessage}` }
                                                                    ],
                                                response_format: { type: "json_object" }
                            })
            });

    if (!ores.ok) {
                    const errTxt = await ores.text();
                    throw new Error(`OpenRouter Erro: ${ores.status} ${errTxt}`);
    }

    const oData = await ores.json();
            const content = oData.choices[0].message.content.trim();

    console.log("[send-prompt] Resposta do OpenRouter recebida. Tamanho:", content.length);

    try {
                    const parsed = JSON.parse(content);
                    return parsed;
    } catch (e) {
                    const match = content.match(/`{3}(?:json)?\s*([\s\S]*?)\s*`{3}/);
                    if (match && match[1]) {
                                        return JSON.parse(match[1]);
                    }
                    throw new Error("Falha ao parsear JSON da IA. Conteudo inesperado.");
    }
}

// === HANDLER PRINCIPAL ===

Deno.serve({ port: 8000, hostname: "0.0.0.0" }, async (req) => {
            if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

               const url = new URL(req.url);

               // Health Check
               if (url.pathname === "/health") {
                               return new Response("OK", { status: 200, headers: corsHeaders });
               }

               if (req.method !== "POST") return errorResponse("Metodo nao permitido", 405);

               if (!OPENROUTER_API_KEY) {
                               console.error("[send-prompt] OPENROUTER_API_KEY nao configurada!");
                               return errorResponse("Servico de IA nao configurado. Adicione OPENROUTER_API_KEY no ambiente.", 503);
               }

               try {
                               const body = await req.json();
                               const { message, projectId, token, files } = body;

                if (!projectId || !token) return errorResponse("Dados incompletos: projectId e token sao obrigatorios.");
                               if (!message && (!files || files.length === 0)) return errorResponse("Informe uma mensagem ou anexe arquivos.");

                console.log(`[send-prompt] Iniciando fluxo Headless para projeto: ${projectId}`);

                const sourceFiles = await getLovableSourceCode(projectId, token);
                               console.log(`[send-prompt] Baixou ${sourceFiles.length} arquivos locais do Lovable.`);

                const aiResult = await callOpenRouter(sourceFiles, message);
                               console.log(`[send-prompt] IA gerou ${aiResult?.changes?.length || 0} edicoes de arquivo.`);

                if (aiResult.changes && Array.isArray(aiResult.changes) && aiResult.changes.length > 0) {
                                    const commitMsg = message.substring(0, 50) + "...";
                                    await applyLovableCodeEdits(projectId, token, aiResult.changes, commitMsg);
                                    console.log(`[send-prompt] Edicoes aplicadas com sucesso via edit-code API.`);
                }

                return jsonResponse({
                                    success: true,
                                    message: "Enviado e aplicado com sucesso!",
                                    explanation: aiResult.explanation,
                                    data: { message: aiResult.explanation }
                });

               } catch (error) {
                               console.error("[send-prompt] Erro geral:", error);
                               if ((error as Error).message.includes("edit-code")) {
                                                   return errorResponse(`Erro ao aplicar codigo no Lovable: ${(error as Error).message}`, 502);
                               }
                               return errorResponse(`Erro interno: ${(error as Error).message}`, 500);
               }
});
