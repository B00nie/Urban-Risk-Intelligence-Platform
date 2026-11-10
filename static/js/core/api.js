// Cliente da API Flask/SQLite (modo 1). Fora dele, o front-end usa o modo demonstrativo local (modo 2).
// Modo API só quando a página veio do próprio Flask: app.py marca as páginas com <meta name="urban-risk-api">.
// Servidas por qualquer hospedagem estática (link público ou servidor local), nenhuma API é consultada.
const SERVIDA_PELO_FLASK = document.querySelector('meta[name="urban-risk-api"]') !== null;
export const API_BASE_URL = 'api'; // relativo: a API está no mesmo servidor que entregou a página

const LOAD_TIMEOUT_MS = 5000;

// Retorna a lista de eventos da API ou null quando ela não está disponível.
export async function fetchEvents() {
    if (!SERVIDA_PELO_FLASK) return null;
    try {
        const res = await fetch(`${API_BASE_URL}/events`, { method: 'GET', signal: AbortSignal.timeout(LOAD_TIMEOUT_MS) });
        const data = res.ok ? await res.json() : null;
        if (Array.isArray(data) && data.length > 0) {
            return data;
        }
        console.warn(`API local respondeu sem eventos utilizáveis (HTTP ${res.status}); mantendo o modo demonstrativo local.`);
    } catch (err) {
        // O navegador já registra a falha de rede no console; aqui só se registra o modo adotado.
        console.info(`API local indisponível em ${API_BASE_URL} (${err.message}); usando o modo demonstrativo local.`);
    }
    return null;
}

// Grava a alteração na API. Retorna true se a API confirmou a gravação.
// keepalive: a requisição continua mesmo se o usuário mudar de página logo em seguida.
export async function syncEvent(evt, actionType) {
    const requests = {
        create: () => fetch(`${API_BASE_URL}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(evt),
            keepalive: true
        }),
        confirm: () => fetch(`${API_BASE_URL}/events/${encodeURIComponent(evt.id)}/confirm`, { method: 'POST', keepalive: true }),
        state: () => fetch(`${API_BASE_URL}/events/${encodeURIComponent(evt.id)}/state`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: evt.state, agentValidated: evt.agentValidated }),
            keepalive: true
        })
    };
    try {
        const res = await requests[actionType]();
        return res.ok;
    } catch (err) {
        console.warn('Falha ao gravar na API local:', err);
        return false;
    }
}
