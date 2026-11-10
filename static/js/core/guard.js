// Guarda de navegação das páginas internas e destino seguro após o login.
// No modo demonstrativo é a única barreira e pode ser contornada no navegador (ex.: editando o storage).
// No Flask, o servidor também bloqueia as páginas e a API; este guard só evita telas vazias e revalida o histórico.
import { restoreSession } from './auth.js';

export const LOGIN_PAGE = 'index.html';
const DEFAULT_PAGE = 'painel.html';
export const INTERNAL_PAGES = [
    'painel.html', 'alertas.html', 'detalhes.html', 'confianca.html',
    'registro.html', 'notificacoes.html', 'perfil.html'
];
const EVENT_ID = /^[A-Za-z0-9-]{1,64}$/;

// Aceita só "pagina.html" da lista, opcionalmente com "?evento=ID", relativo à pasta atual.
// Qualquer outra coisa (URL absoluta, "//host", "javascript:", "../", outros parâmetros) vira o painel.
export function safeDestination(raw) {
    const match = typeof raw === 'string' ? /^([a-z]+\.html)(?:\?evento=([^&#]*))?$/.exec(raw) : null;
    if (!match || !INTERNAL_PAGES.includes(match[1])) return DEFAULT_PAGE;
    if (match[2] === undefined) return match[1];
    let eventId;
    try {
        eventId = decodeURIComponent(match[2]);
    } catch {
        return match[1];
    }
    return EVENT_ID.test(eventId) ? `${match[1]}?evento=${encodeURIComponent(eventId)}` : match[1];
}

function currentDestination() {
    const page = window.location.pathname.split('/').pop();
    const eventId = new URLSearchParams(window.location.search).get('evento');
    return safeDestination(eventId ? `${page}?evento=${encodeURIComponent(eventId)}` : page);
}

// reason: 'sessao' (precisa entrar) | 'saiu' (logout concluído)
export function loginUrl(destination, reason) {
    const params = new URLSearchParams();
    if (destination) params.set('destino', destination);
    if (reason) params.set('motivo', reason);
    const query = params.toString();
    return query ? `${LOGIN_PAGE}?${query}` : LOGIN_PAGE;
}

// replace: a página protegida não fica no histórico como etapa a que se volta sem sessão.
export function redirectToLogin(reason = 'sessao') {
    window.location.replace(loginUrl(currentDestination(), reason));
}

// Antes de estado, dados e componentes. Retorna o usuário, ou null depois de mandar para o login.
export async function requireSession() {
    const user = await restoreSession();
    if (!user) redirectToLogin();
    return user;
}

// Voltar/Avançar pode restaurar a página do cache do navegador (bfcache) sem rodar o módulo de novo.
// Revalida nesse caso: depois do logout, a página restaurada vai para o login.
export function revalidateOnHistoryReturn() {
    window.addEventListener('pageshow', async e => {
        if (!e.persisted) return;
        const user = await restoreSession().catch(() => null);
        if (!user) redirectToLogin();
    });
}
