// Barra lateral com links reais para as sete páginas internas (a Tela 1 é o login, fora da sessão).
// Desktop: fixa ao lado do conteúdo. Celular: painel recolhível (botão no cabeçalho, Escape fecha, foco gerenciado).
import * as state from '../core/state.js';

const PAGES = [
    { id: 'painel', file: 'painel.html', tela: 'T2', icon: 'fa-map-location-dot', label: 'Visão geral e mapa' },
    { id: 'alertas', file: 'alertas.html', tela: 'T3', icon: 'fa-list-check', label: 'Lista priorizada', badge: 'navAlertCount' },
    { id: 'detalhes', file: 'detalhes.html', tela: 'T4', icon: 'fa-diagram-project', label: 'Detalhes e ciclo de vida' },
    { id: 'confianca', file: 'confianca.html', tela: 'T5', icon: 'fa-magnifying-glass-chart', label: 'Origem e confiança' },
    { id: 'registro', file: 'registro.html', tela: 'T6', icon: 'fa-bullhorn', label: 'Registro comunitário' },
    { id: 'notificacoes', file: 'notificacoes.html', tela: 'T7', icon: 'fa-bell', label: 'Central de notificações', badge: 'navNotifCount' },
    { id: 'perfil', file: 'perfil.html', tela: 'T8', icon: 'fa-lock', label: 'Perfil, zonas e privacidade' }
];

const badgeClass = {
    navAlertCount: 'bg-red-500/20 text-red-300',
    navNotifCount: 'bg-indigo-500 text-white'
};

const desktop = window.matchMedia('(min-width: 1280px)');

export function initSidebar(activePageId) {
    const aside = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const toggle = document.getElementById('sidebarToggle');

    aside.innerHTML = `
        <div class="flex items-center justify-between px-4 py-4 border-b border-slate-800">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Telas do protótipo</span>
            <button type="button" id="sidebarClose" class="xl:hidden w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center" aria-label="Fechar menu de navegação">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
        </div>
        <nav aria-label="Telas do protótipo">
            <ul class="p-3 space-y-1">
                ${PAGES.map(p => {
                    const active = p.id === activePageId;
                    const cls = active
                        ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                        : 'text-slate-300 font-medium hover:bg-slate-800';
                    return `
                        <li>
                            <a href="${p.file}" ${active ? 'aria-current="page"' : ''} class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs transition ${cls}">
                                <span class="px-1.5 rounded ${active ? 'bg-indigo-500' : 'bg-slate-700'} text-[11px] font-mono">${p.tela}</span>
                                <i class="fa-solid ${p.icon} w-4 text-center" aria-hidden="true"></i>
                                <span class="flex-1">${p.label}</span>
                                ${p.badge ? `<span id="${p.badge}" class="px-1.5 rounded-full text-[11px] font-bold ${badgeClass[p.badge]}"></span>` : ''}
                            </a>
                        </li>
                    `;
                }).join('')}
            </ul>
        </nav>
    `;

    const isOpen = () => aside.classList.contains('is-open');

    function open() {
        aside.classList.add('is-open');
        backdrop.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        (aside.querySelector('[aria-current="page"]') || aside.querySelector('a')).focus();
    }

    function close({ restoreFocus = true } = {}) {
        if (!isOpen()) return;
        aside.classList.remove('is-open');
        backdrop.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        if (restoreFocus) toggle.focus();
    }

    toggle.addEventListener('click', () => (isOpen() ? close() : open()));
    aside.querySelector('#sidebarClose').addEventListener('click', () => close());
    backdrop.addEventListener('click', () => close());

    document.addEventListener('keydown', e => {
        if (!isOpen() || desktop.matches) return;
        if (e.key === 'Escape') {
            close();
        } else if (e.key === 'Tab') {
            // Mantém o foco dentro do menu aberto no celular.
            const focusables = [...aside.querySelectorAll('a, button')];
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });

    // Ao passar para o desktop, a barra fica sempre visível: desfaz o estado de menu aberto.
    desktop.addEventListener('change', () => close({ restoreFocus: false }));
    // Ao sair da página com o menu aberto: o botão Voltar não restaura o menu aberto (cache de navegação).
    window.addEventListener('pagehide', () => close({ restoreFocus: false }));
}

export function updateSidebarCounts() {
    const active = state.getEvents().filter(e => e.state !== 'Encerrado' && e.state !== 'Descartado');
    const unread = state.getNotifications().filter(n => n.unread).length;
    document.getElementById('navAlertCount').textContent = active.length;
    document.getElementById('navNotifCount').textContent = unread;
}
