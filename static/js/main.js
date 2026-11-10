// Ponto de entrada comum das oito páginas (ES module, sem bundler).
// Monta cabeçalho e barra lateral, carrega os dados (API Flask/SQLite ou modo local) e inicializa
// apenas o módulo da página atual, indicado por <body data-page="...">.
import { fetchEvents } from './core/api.js';
import * as state from './core/state.js';
import { ensureSeedNotifications } from './core/actions.js';
import { renderHeader, updateHeader } from './components/header.js';
import { initSidebar, updateSidebarCounts } from './components/sidebar.js';
import { showToast } from './components/toast.js';

const PAGE_MODULES = {
    acesso: () => import('./pages/acesso.js'),
    painel: () => import('./pages/painel.js'),
    alertas: () => import('./pages/alertas.js'),
    detalhes: () => import('./pages/detalhes.js'),
    confianca: () => import('./pages/confianca.js'),
    registro: () => import('./pages/registro.js'),
    notificacoes: () => import('./pages/notificacoes.js'),
    perfil: () => import('./pages/perfil.js')
};

async function start() {
    document.getElementById('bootNotice')?.remove(); // o JavaScript iniciou; boot-guard.js o devolve se a carga não terminar
    const pageId = document.body.dataset.page;
    const loadPage = PAGE_MODULES[pageId];
    if (!loadPage) {
        console.error(`Página desconhecida: data-page="${pageId}".`);
        return;
    }

    renderHeader();
    initSidebar(pageId);

    // Módulo da página e dados carregam em paralelo. allSettled: se o módulo falhar, o modo de dados
    // ainda é concluído (fetchEvents tem tempo limite de 5 s e não rejeita).
    const [page, data] = await Promise.allSettled([loadPage(), fetchEvents()]);
    state.initData(data.value ?? null);
    ensureSeedNotifications();
    updateHeader();
    updateSidebarCounts();
    if (page.status === 'rejected') throw page.reason;

    const view = page.value.init() || {};

    // Um único ouvinte por página: atualiza o cabeçalho, a barra lateral e a página ativa.
    state.onChange(() => {
        updateHeader();
        updateSidebarCounts();
        view.refresh?.();
    });

    const flash = state.takeFlash();
    if (flash) showToast(flash.message, flash.type);
}

// Separa arquivo que não chegou ao navegador (servidor ou rede) de exceção no próprio JavaScript.
function startupErrorMessage(err) {
    const notDelivered = err instanceof TypeError && /dynamically imported module|module script failed/i.test(err.message);
    return notDelivered
        ? `Um arquivo JavaScript desta tela não chegou ao navegador (servidor parado, resposta interrompida ou arquivo ausente). Confira se o servidor está em execução e recarregue. Detalhe: ${err.message}`
        : `Erro de JavaScript ao iniciar esta tela; não é falha de rede. Detalhe: ${err.name}: ${err.message}. A pilha completa está no console.`;
}

start().catch(err => {
    console.error('Falha ao inicializar a página:', err);
    const box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.className = 'mb-4 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-sm text-red-200';
    box.textContent = startupErrorMessage(err);
    document.getElementById('conteudo')?.prepend(box);

    window.bootGuard?.stopIndicators();
}).finally(() => window.bootGuard?.finish()); // terminou: cancela o aviso genérico de boot-guard.js
