// Contexto do evento entre páginas (?evento=ID na URL), seletor de ocorrência, estado vazio
// e ações sobre o evento exibido (Telas 4 e 5).
import * as state from '../core/state.js';
import { calculateRiskScoreRN02 } from '../core/rules.js';
import { esc } from '../core/escape.js';
import { confirmEventByCommunity, reportEventNormalized, changeEventState } from '../core/actions.js';

// Um único ouvinte delegado por contêiner: os botões data-action são recriados a cada renderização.
export function bindEventActions(container) {
    container.addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const { action, id } = btn.dataset;
        if (action === 'confirm') confirmEventByCommunity(id);
        else if (action === 'normalize') reportEventNormalized(id);
        else if (action === 'state') changeEventState(id, btn.dataset.state, btn.dataset.official === 'true');
    });
}

export const eventUrl = (page, eventId) => `${page}?evento=${encodeURIComponent(eventId)}`;

export const getEventIdFromUrl = () => new URLSearchParams(window.location.search).get('evento');

// Atualiza a URL sem recarregar, para que atualizar a página mantenha o evento escolhido.
export function setEventIdInUrl(eventId) {
    const url = new URL(window.location.href);
    url.searchParams.set('evento', eventId);
    history.replaceState(null, '', url);
}

export function fillEventSelector(select, selectedId) {
    const hasSelection = Boolean(state.findEvent(selectedId));
    const placeholder = hasSelection ? '' : '<option value="" selected disabled>Selecione uma ocorrência…</option>';
    select.innerHTML = placeholder + state.getEvents().map(e => {
        const calc = calculateRiskScoreRN02(e);
        return `<option value="${esc(e.id)}" ${e.id === selectedId ? 'selected' : ''}>[${calc.priorityCode} • Score ${calc.score}] ${esc(e.title)} (${esc(e.neighborhood)})</option>`;
    }).join('');
}

export function emptyStateHtml(requestedId) {
    const message = requestedId
        ? `Ocorrência "${esc(requestedId)}" não encontrada no conjunto carregado.`
        : 'Nenhuma ocorrência selecionada.';
    return `
        <div class="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
            <i class="fa-solid fa-hand-pointer text-indigo-400 text-2xl" aria-hidden="true"></i>
            <p class="text-sm font-semibold text-white">${message}</p>
            <p class="text-xs text-slate-400">
                Escolha uma ocorrência no seletor acima ou abra uma pelo
                <a href="painel.html" class="text-indigo-400 hover:underline">mapa</a> ou pela
                <a href="alertas.html" class="text-indigo-400 hover:underline">lista priorizada</a>.
            </p>
        </div>
    `;
}
