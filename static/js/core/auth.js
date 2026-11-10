// Sessão do usuário nos dois modos, escolhidos de forma determinística pela marca que o app.py injeta:
// - Flask (modo API): login, sessão e logout no servidor; o papel vem da conta no banco.
// - Hospedagem estática (modo demonstrativo): contas fictícias e sessão no sessionStorage.
//   Não é autenticação segura: o storage e o bloqueio de páginas podem ser contornados no navegador.
// Nenhuma senha é guardada em storage. Uma falha do login no Flask nunca vira sessão demonstrativa.
export const SERVED_BY_FLASK = document.querySelector('meta[name="urban-risk-api"]') !== null;

const INSTITUTIONAL = ['defesa_civil', 'cco'];
const ROLE_ICONS = { morador: 'fa-person-walking-luggage', defesa_civil: 'fa-helmet-safety', cco: 'fa-bolt' };

// Contas do modo demonstrativo (personas da seção 1.2). As senhas são públicas de propósito e aparecem
// na tela de login: servem só para percorrer o fluxo e não protegem nada.
export const DEMO_ACCOUNTS = [
    {
        id: 'mariana', username: 'mariana', email: 'mariana@demo.example', password: '1234',
        papel: 'morador', name: 'Mariana Costa', role: 'Moradora • Transporte Público', hash: 'Morador Verificado #A8F92B',
        permissions: 'Visualização, Relato (RF07) e Confirmação Cruzada (RF08)'
    },
    {
        id: 'roberto', username: 'roberto', email: 'roberto@demo.example', password: '1234',
        papel: 'defesa_civil', name: 'Cap. Roberto Mendes', role: 'Agente Local • Defesa Civil', hash: 'Agente Oficial #DEFCIV-019',
        permissions: 'Ações comunitárias + Moderação e Mudança de Estado (RF11)'
    },
    {
        id: 'lucas', username: 'lucas', email: 'lucas@demo.example', password: '1234',
        papel: 'cco', name: 'Eng. Lucas Oliveira', role: 'Operador CCO • Concessionária', hash: 'Operador Técnico #CCO-402',
        permissions: 'Ações comunitárias + Validação Técnica e Mudança de Estado (RF11)'
    }
];

const DEMO_KEY = 'urbanRisk.auth.v1';     // guarda só { accountId, expiresAt }
const DEMO_TTL_MS = 2 * 60 * 60 * 1000;    // mesma duração da sessão do Flask
const TIMEOUT_MS = 8000;

let current = null; // { user, csrfToken }

// Formato único do usuário para as telas (o mesmo da antiga persona).
function toUser(u) {
    return {
        id: u.id,
        name: u.name,
        role: u.role,
        hash: u.hash,
        papel: u.papel,
        isAgent: INSTITUTIONAL.includes(u.papel),
        icon: ROLE_ICONS[u.papel] || 'fa-user'
    };
}

function authError(kind, detail = '') {
    const err = new Error(detail || kind);
    err.kind = kind; // invalid | rate | network | server | storage
    return err;
}

function clearDemoSession() {
    try { sessionStorage.removeItem(DEMO_KEY); } catch { /* storage indisponível: nada a limpar */ }
}

function readDemoAccount() {
    try {
        const saved = JSON.parse(sessionStorage.getItem(DEMO_KEY) || 'null');
        const account = saved && DEMO_ACCOUNTS.find(a => a.id === saved.accountId);
        if (account && typeof saved.expiresAt === 'number' && saved.expiresAt > Date.now()) return account;
    } catch { /* sessão ilegível ou storage bloqueado: trata como sem sessão */ }
    clearDemoSession();
    return null;
}

const api = (path, options = {}) => fetch(`api/auth/${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...options
});

// Sessão existente (sem pedir senha). Retorna o usuário ou null.
// No Flask, falha de rede lança erro: sem confirmação do servidor, nenhuma tela interna é aberta.
export async function restoreSession() {
    if (!SERVED_BY_FLASK) {
        const account = readDemoAccount();
        current = account ? { user: toUser(account), csrfToken: null } : null;
        return current?.user ?? null;
    }
    let res;
    try {
        res = await api('session');
    } catch (err) {
        throw new Error(`Não foi possível verificar a sessão no servidor Flask (${err.message}). Nenhum dado foi carregado; confira o servidor e recarregue.`);
    }
    if (res.status === 401) {
        current = null;
        return null;
    }
    if (!res.ok) throw new Error(`O servidor não confirmou a sessão (HTTP ${res.status}). Nenhum dado foi carregado.`);
    const data = await res.json();
    current = { user: toUser(data.user), csrfToken: data.csrfToken };
    return current.user;
}

export async function login(identifier, password) {
    const id = identifier.trim().toLowerCase();
    if (!SERVED_BY_FLASK) {
        const account = DEMO_ACCOUNTS.find(a => a.username === id || a.email === id);
        if (!account || account.password !== password) throw authError('invalid');
        try {
            sessionStorage.setItem(DEMO_KEY, JSON.stringify({ accountId: account.id, expiresAt: Date.now() + DEMO_TTL_MS }));
        } catch {
            throw authError('storage');
        }
        current = { user: toUser(account), csrfToken: null };
        return current.user;
    }
    let res;
    try {
        res = await api('login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: id, password })
        });
    } catch {
        throw authError('network');
    }
    if (res.status === 401) throw authError('invalid');
    if (res.status === 429) throw authError('rate');
    if (!res.ok) throw authError('server', `HTTP ${res.status}`);
    const data = await res.json();
    current = { user: toUser(data.user), csrfToken: data.csrfToken };
    return current.user;
}

// Encerra a sessão. No Flask, só considera encerrada se o servidor revogou (ou se ela já não existia).
export async function logout() {
    if (!SERVED_BY_FLASK) {
        clearDemoSession();
        current = null;
        return;
    }
    let res;
    try {
        res = await api('logout', { method: 'POST', headers: csrfHeaders() });
    } catch {
        throw new Error('Não foi possível contatar o servidor para encerrar a sessão. Ela continua ativa; tente de novo.');
    }
    if (!res.ok && res.status !== 401) {
        throw new Error(`O servidor não encerrou a sessão (HTTP ${res.status}). Ela continua ativa; tente de novo.`);
    }
    current = null;
}

export const currentUser = () => current?.user ?? null;

// Cabeçalho CSRF para POST/PATCH/DELETE na API (só existe no modo Flask).
export const csrfHeaders = () => (current?.csrfToken ? { 'X-CSRF-Token': current.csrfToken } : {});
