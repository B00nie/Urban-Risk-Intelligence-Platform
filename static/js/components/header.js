// Cabeçalho comum: identificação do protótipo e do modo de dados, simulação de sensor, usuário conectado e Sair.
// Compacto no celular: a faixa de protótipo/modo de dados continua sempre visível.
import * as state from '../core/state.js';
import { simulateIncomingSensorEvent } from '../core/actions.js';
import { logout } from '../core/auth.js';
import { loginUrl } from '../core/guard.js';
import { showToast } from './toast.js';

export function renderHeader() {
    const header = document.getElementById('appHeader');
    header.className = 'sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-2.5';
    header.innerHTML = `
        <!-- Identificação do protótipo e do modo de dados (visível em todas as larguras) -->
        <div class="max-w-[105rem] mx-auto mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span class="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-200 font-semibold">
                <i class="fa-solid fa-flask mr-1" aria-hidden="true"></i>Protótipo acadêmico — FIAP GS 2026.2
            </span>
            <span class="inline-flex items-center gap-1.5 text-slate-300">
                <i class="fa-solid fa-database text-indigo-400" aria-hidden="true"></i>
                <span id="dataModeBanner" role="status">Verificando API local…</span>
            </span>
        </div>
        <div class="max-w-[105rem] mx-auto flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
                <button type="button" id="sidebarToggle" class="xl:hidden shrink-0 w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center transition"
                        aria-controls="appSidebar" aria-expanded="false" aria-label="Abrir menu de navegação">
                    <i class="fa-solid fa-bars" aria-hidden="true"></i>
                </button>
                <div class="hidden sm:flex shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 items-center justify-center shadow-lg shadow-indigo-500/20">
                    <i class="fa-solid fa-shield-halved text-white text-lg" aria-hidden="true"></i>
                </div>
                <div class="min-w-0">
                    <div class="flex items-center gap-2">
                        <h1 class="font-bold text-base md:text-lg tracking-tight text-white truncate">Urban Risk<span class="hidden sm:inline"> Intelligence</span></h1>
                        <span class="hidden 2xl:inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            CitizenTech GS 2026.2
                        </span>
                    </div>
                    <p class="hidden md:block text-xs text-slate-400 truncate">Monitoramento Integrado de Riscos Urbanos • Sensores IoT, Bases Públicas e Comunidade</p>
                </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
                <!-- RNF01: meta da arquitetura-alvo (não medida neste protótipo); no celular aparece no painel -->
                <div class="hidden lg:flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-lg text-xs" title="RNF01: meta da arquitetura-alvo; latência não medida neste protótipo">
                    <i class="fa-solid fa-bullseye text-indigo-400" aria-hidden="true"></i>
                    <span class="text-slate-300">Meta de atualização:</span>
                    <span class="font-mono font-semibold text-indigo-300">&le; 5s</span>
                </div>

                <!-- Quick Simulate IoT Sensor Event Button (RF03) -->
                <button type="button" id="btnSimulateSensor" class="h-10 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 px-3 rounded-lg text-xs font-medium transition flex items-center gap-1.5" aria-label="Simular leitura de sensor IoT">
                    <i class="fa-solid fa-satellite-dish" aria-hidden="true"></i>
                    <span class="hidden md:inline">Simular Sensor IoT</span>
                </button>

                <!-- Usuário conectado: o perfil pertence à conta (para trocar, use Sair) -->
                <div id="activePersonaChip" class="h-10 min-w-10 flex items-center justify-center gap-2 bg-indigo-600/20 border border-indigo-500/40 px-3 rounded-lg text-xs">
                    <i id="activePersonaIcon" class="fa-solid fa-user-check text-indigo-400" aria-hidden="true"></i>
                    <span class="text-left">
                        <!-- No celular só o ícone aparece; o nome continua acessível ao leitor de tela e no title -->
                        <span class="sr-only">Conectado como </span>
                        <span id="activePersonaName" class="sr-only sm:not-sr-only sm:block font-semibold text-white leading-none">—</span>
                        <span id="activePersonaRole" class="hidden sm:block text-xs text-indigo-300 mt-0.5">—</span>
                    </span>
                </div>

                <button type="button" id="btnLogout" class="h-10 min-w-10 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5">
                    <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
                    <span class="sr-only md:not-sr-only">Sair</span>
                </button>
            </div>
        </div>
    `;
    header.querySelector('#btnSimulateSensor').addEventListener('click', () => simulateIncomingSensorEvent());
    header.querySelector('#btnLogout').addEventListener('click', e => signOut(e.currentTarget));
    updatePersona();
}

// Sair: encerra a sessão (no Flask, revogada no servidor) e apaga só o estado deste usuário no navegador.
// Banco, eventos compartilhados e dados de outras contas não são tocados.
async function signOut(button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
        await logout();
    } catch (err) {
        showToast(err.message, 'warning');
        button.disabled = false;
        button.removeAttribute('aria-busy');
        return;
    }
    state.clearUserState();
    window.location.replace(loginUrl(null, 'saiu'));
}

function updatePersona() {
    const persona = state.getPersona();
    document.getElementById('activePersonaName').textContent = persona.name;
    document.getElementById('activePersonaRole').textContent = persona.role;
    document.getElementById('activePersonaIcon').className = `fa-solid ${persona.icon} text-indigo-400`;
    document.getElementById('activePersonaChip').title = `Conectado como ${persona.name} (${persona.role})`;
}

// Chamado depois que os dados foram carregados e a cada mudança de estado.
export function updateHeader() {
    updatePersona();
    document.getElementById('dataModeBanner').textContent = state.isApiMode()
        ? 'API Flask/SQLite conectada — dados de demonstração'
        : 'Modo demonstrativo local — dados em JavaScript (sessão do navegador)';
}
