// Cliente da API Flask/SQLite (modo 1). Fora dele, o front-end usa o modo demonstrativo local (modo 2).
// Modo API só quando a página veio do próprio Flask (marca detectada em auth.js).
// Servidas por qualquer hospedagem estática (link público ou servidor local), nenhuma API é consultada.
// Toda chamada leva o cookie de sessão; as que alteram dados levam também o token CSRF.
import { SERVED_BY_FLASK, csrfHeaders } from './auth.js';
import { redirectToLogin } from './guard.js';

export const API_BASE_URL = 'api'; // relativo: a API está no mesmo servidor que entregou a página

const LOAD_TIMEOUT_MS = 5000;

// A sessão acabou (expirou ou foi revogada em outra aba): vai para o login e interrompe a carga.
function sessionEnded() {
    redirectToLogin();
    const err = new Error('Sessão encerrada no servidor.');
    err.name = 'SessionEnded';
    return err;
}

// Lista de eventos da API, ou null quando ela não está disponível (modo demonstrativo local).
// Sem sessão (401) rejeita: dados locais não substituem uma sessão do servidor que acabou.
export async function fetchEvents() {
    if (!SERVED_BY_FLASK) return null;
    let res;
    try {
        res = await fetch(`${API_BASE_URL}/events`, { method: 'GET', credentials: 'same-origin', signal: AbortSignal.timeout(LOAD_TIMEOUT_MS) });
    } catch (err) {
        // O navegador já registra a falha de rede no console; aqui só se registra o modo adotado.
        console.info(`API local indisponível em ${API_BASE_URL} (${err.message}); usando o modo demonstrativo local.`);
        return null;
    }
    if (res.status === 401) throw sessionEnded();
    const data = res.ok ? await res.json().catch(() => null) : null;
    if (Array.isArray(data) && data.length > 0) return data;
    console.warn(`API local respondeu sem eventos utilizáveis (HTTP ${res.status}); mantendo o modo demonstrativo local.`);
    return null;
}

// Grava a alteração na API. Retorna { ok, status, data, error }.
// keepalive: a requisição continua mesmo se o usuário mudar de página logo em seguida.
// O servidor decide autor, papel e validação institucional pela sessão, não por este payload.
export async function syncEvent(evt, actionType) {
    const send = (path, method, body) => fetch(`${API_BASE_URL}/${path}`, {
        method,
        credentials: 'same-origin',
        headers: { ...csrfHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        keepalive: true
    });
    const id = encodeURIComponent(evt.id);
    const requests = {
        create: () => send('events', 'POST', evt),
        sensor: () => send('simulacoes/sensor', 'POST'),
        confirm: () => send(`events/${id}/confirm`, 'POST'),
        state: () => send(`events/${id}/state`, 'PATCH', { state: evt.state, agentValidated: evt.agentValidated })
    };
    try {
        const res = await requests[actionType]();
        const data = await res.json().catch(() => null);
        if (res.status === 401) sessionEnded();
        return { ok: res.ok, status: res.status, data, error: data?.error };
    } catch (err) {
        console.warn('Falha ao gravar na API local:', err);
        return { ok: false, status: 0, data: null, error: err.message };
    }
}
