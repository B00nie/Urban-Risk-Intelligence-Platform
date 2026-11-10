// Ponto de entrada comum das oito páginas (ES module, sem bundler), indicado por <body data-page="...">.
// Login (acesso): só o módulo da tela; nenhum estado ou dado interno é carregado antes de autenticar.
// Páginas internas: 1) sessão verificada (guard.js); 2) estado, componentes e dados; 3) módulo da página.
import { requireSession, revalidateOnHistoryReturn } from './core/guard.js';

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

    if (pageId === 'acesso') {
        await (await loadPage()).init();
        return;
    }

    const user = await requireSession();
    if (!user) return; // a caminho do login
    revalidateOnHistoryReturn();

    const [state, actions, header, sidebar, toast, api] = await Promise.all([
        import('./core/state.js'),
        import('./core/actions.js'),
        import('./components/header.js'),
        import('./components/sidebar.js'),
        import('./components/toast.js'),
        import('./core/api.js')
    ]);
    state.bindUser(user.id);
    header.renderHeader();
    sidebar.initSidebar(pageId);

    // Módulo da página e dados carregam em paralelo. allSettled: se o módulo falhar, o modo de dados
    // ainda é concluído (fetchEvents tem tempo limite de 5 s e só rejeita se a sessão acabou).
    const [page, data] = await Promise.allSettled([loadPage(), api.fetchEvents()]);
    if (data.status === 'rejected') throw data.reason;
    state.initData(data.value);
    actions.ensureSeedNotifications();
    header.updateHeader();
    sidebar.updateSidebarCounts();
    if (page.status === 'rejected') throw page.reason;

    const view = page.value.init() || {};

    // Um único ouvinte por página: atualiza o cabeçalho, a barra lateral e a página ativa.
    state.onChange(() => {
        header.updateHeader();
        sidebar.updateSidebarCounts();
        view.refresh?.();
    });

    const flash = state.takeFlash();
    if (flash) toast.showToast(flash.message, flash.type);
}

// Separa arquivo que não chegou ao navegador (servidor ou rede) de exceção no próprio JavaScript.
function startupErrorMessage(err) {
    const notDelivered = err instanceof TypeError && /dynamically imported module|module script failed/i.test(err.message);
    if (notDelivered) {
        return `Um arquivo JavaScript desta tela não chegou ao navegador (servidor parado, resposta interrompida ou arquivo ausente). Confira se o servidor está em execução e recarregue. Detalhe: ${err.message}`;
    }
    // Mensagens de sessão (auth.js) já explicam o que houve.
    return err.name === 'Error' ? err.message : `Erro de JavaScript ao iniciar esta tela; não é falha de rede. Detalhe: ${err.name}: ${err.message}. A pilha completa está no console.`;
}

start().catch(err => {
    if (err.name === 'SessionEnded') return; // sessão expirou durante a carga: já a caminho do login
    console.error('Falha ao inicializar a página:', err);
    const box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.className = 'mb-4 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-sm text-red-200';
    box.textContent = startupErrorMessage(err);
    document.getElementById('conteudo')?.prepend(box);

    window.bootGuard?.stopIndicators();
}).finally(() => window.bootGuard?.finish()); // terminou: cancela o aviso genérico de boot-guard.js
