// Tela 3 (alertas.html): lista priorizada pelo Score de Risco (RF04, RN02) com filtros multifatoriais.
import * as state from '../core/state.js';
import { calculateRiskScoreRN02 } from '../core/rules.js';
import { getCategoryMeta, getSourceMeta } from '../core/data.js';
import { eventUrl } from '../components/eventPicker.js';
import { esc } from '../core/escape.js';

const FILTER_IDS = ['filterCategory', 'filterNeighborhood', 'filterRiskBand', 'filterState', 'filterMinConfidence'];

// Bairros vêm dos eventos carregados; a seleção é mantida quando a lista muda.
function fillNeighborhoodFilter() {
    const select = document.getElementById('filterNeighborhood');
    const current = select.value;
    const names = [...new Set(state.getEvents().map(e => e.neighborhood))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    select.innerHTML = '<option value="ALL">Todos os Bairros</option>'
        + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    select.value = names.includes(current) ? current : 'ALL';
}

function renderAlertList() {
    const catFilter = document.getElementById('filterCategory').value;
    const neighborhoodFilter = document.getElementById('filterNeighborhood').value;
    const bandFilter = document.getElementById('filterRiskBand').value;
    const stateFilter = document.getElementById('filterState').value;
    const minConf = parseInt(document.getElementById('filterMinConfidence').value || '0', 10);

    const sorted = [...state.getEvents()]
        .map(evt => ({ evt, calc: calculateRiskScoreRN02(evt) }))
        .filter(({ evt, calc }) => {
            if (catFilter !== 'ALL' && evt.category !== catFilter) return false;
            if (neighborhoodFilter !== 'ALL' && evt.neighborhood !== neighborhoodFilter) return false;
            if (bandFilter !== 'ALL' && calc.band !== bandFilter) return false;
            if (stateFilter !== 'ALL' && evt.state !== stateFilter) return false;
            if (calc.nc < minConf) return false;
            return true;
        })
        .sort((a, b) => b.calc.score - a.calc.score);

    const container = document.getElementById('prioritizedAlertList');
    if (!sorted.length) {
        container.innerHTML = `
            <div class="p-8 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-400 text-sm">
                Nenhum alerta encontrado para os filtros selecionados.
            </div>
        `;
        return;
    }

    container.innerHTML = sorted.map(({ evt, calc }) => {
        const meta = getCategoryMeta(evt.category);
        const src = getSourceMeta(evt.sourceType);
        return `
            <div class="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 hover:border-slate-700 transition flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div class="space-y-2 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="px-2.5 py-1 rounded-md text-xs font-bold border ${calc.badgeClass}">
                            ${calc.label} • Score ${calc.score}/100
                        </span>
                        <span class="px-2.5 py-1 rounded-md text-xs font-mono border ${calc.sealClass}">
                            <i class="fa-solid fa-check-circle mr-1"></i>Confiança: ${calc.nc}% (${calc.sealLabel})
                        </span>
                        <span class="px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-700 bg-slate-800/80 text-slate-200"><i class="fa-solid ${src.icon} mr-1" aria-hidden="true"></i>Origem: ${src.label}</span>
                        <span class="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-indigo-300 border border-slate-700">
                            Estado UML: ${esc(evt.state)}
                        </span>
                        <span class="text-xs text-slate-400 font-mono">${esc(evt.id)} • ${esc(evt.timestamp)}</span>
                    </div>

                    <h3 class="text-base font-bold text-white flex items-center gap-2">
                        <i class="fa-solid ${meta.icon} ${meta.color}"></i>
                        <span>${esc(evt.title)}</span>
                    </h3>

                    <p class="text-xs text-slate-300 leading-relaxed">${esc(evt.description)}</p>

                    <div class="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                        <span><i class="fa-solid fa-location-dot text-indigo-400 mr-1"></i><strong>Local:</strong> ${esc(evt.neighborhood)}</span>
                        <span><i class="fa-solid fa-database text-emerald-400 mr-1"></i><strong>Origem:</strong> ${esc(evt.sourceName)}</span>
                        <span><i class="fa-solid fa-users text-amber-400 mr-1"></i><strong>Confirmações (Raio 500m):</strong> ${esc(evt.communityConfirmations)}</span>
                    </div>
                </div>

                <div class="flex sm:flex-row lg:flex-col gap-2 w-full lg:w-auto shrink-0">
                    <a href="${esc(eventUrl('detalhes.html', evt.id))}" class="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-diagram-project"></i> Detalhes & Ciclo (Tela 4)
                    </a>
                    <a href="${esc(eventUrl('confianca.html', evt.id))}" class="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-magnifying-glass-chart"></i> Origem & Confiança (Tela 5)
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

export function init() {
    FILTER_IDS.forEach(id => document.getElementById(id).addEventListener('change', renderAlertList));
    fillNeighborhoodFilter();
    renderAlertList();
    return {
        refresh() {
            fillNeighborhoodFilter();
            renderAlertList();
        }
    };
}
