// Tela 1 (index.html): login (RF01) e consentimento LGPD (RNF05, RN03).
// Antes de autenticar, nenhum estado ou dado interno é carregado; o perfil vem da conta (core/auth.js).
// A senha digitada só vai para login() e é apagada do campo em seguida; nunca é guardada.
import { SERVED_BY_FLASK, DEMO_ACCOUNTS, login, restoreSession } from '../core/auth.js';
import { safeDestination } from '../core/guard.js';
import { esc } from '../core/escape.js';

const ROLE_STYLE = {
    morador: { icon: 'fa-person-walking-luggage' },
    defesa_civil: { icon: 'fa-helmet-safety' },
    cco: { icon: 'fa-bolt' }
};

const ERRORS = {
    invalid: 'Usuário ou senha inválidos.',
    rate: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.',
    network: 'Não foi possível contatar o servidor de autenticação. Nenhuma sessão foi iniciada; confira se o Flask está em execução.',
    server: 'O servidor de autenticação respondeu com erro. Nenhuma sessão foi iniciada.',
    storage: 'O navegador bloqueou o armazenamento da sessão demonstrativa (sessionStorage). Libere-o para continuar.'
};
const NOTICES = {
    sessao: 'Entre para acessar a página solicitada.',
    saiu: 'Sessão encerrada. Para continuar, entre novamente.'
};

const $ = id => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const destination = safeDestination(params.get('destino')); // só páginas internas da lista

const goToDestination = () => window.location.replace(destination);

function showNotice(message) {
    $('loginNotice').textContent = message;
    $('loginNotice').classList.remove('hidden');
}

function showError(message, focusEl) {
    const box = $('loginError');
    box.textContent = message;
    box.classList.remove('hidden');
    const invalid = focusEl === $('loginIdentifier') || focusEl === $('loginPassword') ? [focusEl] : [];
    [$('loginIdentifier'), $('loginPassword')].forEach(el => el.setAttribute('aria-invalid', String(invalid.includes(el))));
    focusEl?.focus();
}

function clearError() {
    $('loginError').classList.add('hidden');
    $('loginError').textContent = '';
    [$('loginIdentifier'), $('loginPassword')].forEach(el => el.removeAttribute('aria-invalid'));
}

function setBusy(busy) {
    const button = $('btnLogin');
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
    $('btnLoginLabel').textContent = busy ? 'Entrando…' : 'Entrar';
    $('btnLoginIcon').className = busy ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-right-to-bracket';
    $('loginIdentifier').readOnly = busy;
    $('loginPassword').readOnly = busy;
}

function togglePasswordVisibility() {
    const input = $('loginPassword');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('togglePassword').setAttribute('aria-pressed', String(show));
    $('togglePasswordIcon').className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
}

// Só informa usuários e perfis; o formulário não é preenchido nem enviado por esta seção.
function renderDemoAccounts() {
    $('demoAccountsList').innerHTML = DEMO_ACCOUNTS.map(a => {
        const s = ROLE_STYLE[a.papel];
        return `
            <li class="flex items-start gap-3">
                <i class="fa-solid ${s.icon} w-4 text-center mt-0.5 text-slate-400" aria-hidden="true"></i>
                <span class="min-w-0">
                    <code class="font-mono text-slate-100">${esc(a.username)}</code>
                    <span class="text-slate-400">— ${esc(a.name)}, ${esc(a.role)}</span>
                    <span class="block text-slate-500">${esc(a.permissions)}</span>
                </span>
            </li>
        `;
    }).join('');
}

async function onSubmit(e) {
    e.preventDefault();
    if ($('btnLogin').disabled) return;
    clearError();
    const identifier = $('loginIdentifier').value.trim();
    const passwordInput = $('loginPassword');
    if (!identifier || !passwordInput.value) {
        showError('Informe usuário e senha.', identifier ? passwordInput : $('loginIdentifier'));
        return;
    }
    // Só a ciência do aviso é exigida; geolocalização e notificações são escolhas opcionais.
    if (!$('lgpdConsentAnon').checked) {
        showError('Para entrar, marque a ciência do aviso de privacidade da demonstração. Geolocalização e notificações são opcionais.', $('lgpdConsentAnon'));
        return;
    }

    setBusy(true);
    let user;
    try {
        user = await login(identifier, passwordInput.value);
    } catch (err) {
        setBusy(false);
        passwordInput.value = '';
        showError(ERRORS[err.kind] || ERRORS.server, err.kind === 'invalid' ? passwordInput : $('loginIdentifier'));
        return;
    }
    passwordInput.value = '';

    // Estado interno só depois de autenticar: consentimentos ficam ligados à conta que entrou.
    const state = await import('../core/state.js');
    state.bindUser(user.id);
    state.setConsent('geo', $('lgpdConsentGeo').checked);
    state.setConsent('anon', $('lgpdConsentAnon').checked);
    state.setConsent('push', $('lgpdConsentPush').checked);
    state.setFlash(`Sessão iniciada como ${user.name} (${user.role}). Consentimento LGPD registrado nesta sessão.`, 'success');
    goToDestination();
}

export async function init() {
    $('authModeBanner').textContent = SERVED_BY_FLASK
        ? 'Servidor Flask local — autenticação no servidor'
        : 'Modo demonstrativo — acesso simulado no navegador';
    (SERVED_BY_FLASK ? $('serverAuthPanel') : $('demoAccountsPanel')).hidden = false;
    if (!SERVED_BY_FLASK) renderDemoAccounts();
    if (NOTICES[params.get('motivo')]) showNotice(NOTICES[params.get('motivo')]);

    $('loginForm').addEventListener('submit', onSubmit);
    $('togglePassword').addEventListener('click', togglePasswordVisibility);

    // Já há sessão válida (ex.: link para o login): segue para o destino sem pedir senha de novo.
    try {
        if (await restoreSession()) {
            goToDestination();
            return;
        }
    } catch (err) {
        showError(err.message); // servidor inacessível: o formulário continua disponível
    }
    $('btnLogin').disabled = false;

    // Voltar para o login depois de entrar (cache do navegador): com sessão válida, segue para o destino.
    window.addEventListener('pageshow', async e => {
        if (e.persisted && await restoreSession().catch(() => null)) goToDestination();
    });
}
