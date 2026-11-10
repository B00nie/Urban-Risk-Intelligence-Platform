// Tela 4 (detalhes.html): detalhes, ciclo de vida UML (RF05), validação cruzada (RF08) e moderação (RF11).
// O evento vem de ?evento=ID; sem evento válido, mostra o estado vazio com seletor.
import * as state from '../core/state.js';
import { calculateRiskScoreRN02 } from '../core/rules.js';
import { getCategoryMeta, getSourceMeta, allowedTransitions, isFinalState } from '../core/data.js';
import { eventUrl, getEventIdFromUrl, setEventIdInUrl, fillEventSelector, emptyStateHtml, bindEventActions } from '../components/eventPicker.js';
import { esc } from '../core/escape.js';

function detailHtml(evt) {
    const persona = state.getPersona();
    const allowed = allowedTransitions(evt.state);
    const normalizationCount = state.getNormalizationCount(evt.id);
    const calc = calculateRiskScoreRN02(evt);
    const meta = getCategoryMeta(evt.category);
    const src = getSourceMeta(evt.sourceType);

    const lifecycleStates = [
        'Reportado',
        'Em Validação',
        'Confirmado',
        'Alerta Emitido',
        'Em Monitoramento',
        'Encerrado'
    ];
    const currentIdx = lifecycleStates.indexOf(evt.state);

    return `
        <div class="space-y-6">
            <!-- Header Summary Banner -->
            <div class="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div class="space-y-1.5">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="px-2.5 py-1 rounded-md text-xs font-bold border ${calc.badgeClass}">
                            ${calc.label} • Score ${calc.score}/100
                        </span>
                        <span class="px-2.5 py-1 rounded-md text-xs font-mono border ${calc.sealClass}">
                            Confiança: ${calc.nc}% (${calc.sealLabel})
                        </span>
                        <span class="px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-700 bg-slate-800/80 text-slate-200"><i class="fa-solid ${src.icon} mr-1" aria-hidden="true"></i>Origem: ${src.label}</span>
                        <span class="text-xs font-mono text-slate-400">${esc(evt.id)}</span>
                    </div>
                    <h3 class="text-xl font-bold text-white flex items-center gap-2">
                        <i class="fa-solid ${meta.icon} ${meta.color}"></i>
                        <span>${esc(evt.title)}</span>
                    </h3>
                    <p class="text-xs text-slate-400">
                        <i class="fa-solid fa-location-dot text-indigo-400 mr-1"></i>${esc(evt.neighborhood)} (Coordenadas públicas truncadas ~100m — RN03: ${Number(evt.lat).toFixed(3)}, ${Number(evt.lng).toFixed(3)}) • Atualizado ${esc(evt.timestamp)}
                    </p>
                </div>

                <a href=\"${esc(eventUrl('confianca.html', evt.id))}\" class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20">
                    <i class="fa-solid fa-magnifying-glass-chart"></i>
                    <span>Inspecionar Memória de Cálculo de Confiança (Tela 5)</span>
                </a>
            </div>

            <!-- UML State Diagram Lifecycle Stepper (Deliverable 3 Coherence) -->
            <div class="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="text-sm font-bold text-white flex items-center gap-2">
                        <i class="fa-solid fa-diagram-next text-indigo-400"></i>
                        <span>Ciclo de Vida do Evento de Risco (Coerente com o Diagrama de Estados UML)</span>
                    </h4>
                    <span class="px-2.5 py-1 rounded text-xs font-mono font-semibold bg-indigo-500/20 text-indigo-300">
                        Estado Atual: ${esc(evt.state)}
                    </span>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    ${lifecycleStates.map((st, idx) => {
                        const isDone = currentIdx >= idx && evt.state !== 'Descartado';
                        const isCurrent = evt.state === st;
                        const boxClass = isCurrent
                            ? 'border-2 border-indigo-500 bg-indigo-950/50 text-white'
                            : isDone
                            ? 'border border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                            : 'border border-slate-800 bg-slate-900/60 text-slate-500';
                        return `
                            <div class="p-3 rounded-xl ${boxClass} text-center relative">
                                <div class="text-[11px] font-mono uppercase">Estado ${idx + 1}</div>
                                <div class="font-bold text-xs mt-1">${st}</div>
                                <div class="mt-1 text-[11px]">
                                    ${isCurrent ? '<i class="fa-solid fa-circle-dot text-indigo-400"></i> Ativo Agora' : isDone ? '<i class="fa-solid fa-check text-emerald-400"></i> Concluído' : 'Pendente'}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                ${evt.state === 'Descartado' ? `
                    <div class="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-300 font-semibold">
                        <i class="fa-solid fa-ban mr-1"></i> Evento no Estado Final: DESCARTADO (Rejeitado por falta de confiança após timeout ou fraude).
                    </div>
                ` : ''}
            </div>

            <!-- 2 Columns: Operational Info + Collaborative Validation / Agent Controls -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <!-- Left: Description & Safety Recommendations -->
                <div class="lg:col-span-7 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                    <div>
                        <h4 class="text-sm font-bold text-white mb-1">Descrição Técnica e Perímetro Afetado</h4>
                        <p class="text-xs text-slate-300 leading-relaxed">${esc(evt.description)}</p>
                    </div>

                    <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                        <span class="text-slate-400"><i class="fa-solid fa-clock text-amber-400 mr-1.5"></i>Previsão Operacional / Status de Campo:</span>
                        <span class="font-semibold text-amber-300">${esc(evt.slaEstimate)}</span>
                    </div>

                    <div>
                        <h4 class="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                            <i class="fa-solid fa-kit-medical text-emerald-400"></i>
                            <span>Recomendações de Autoproteção para Moradores</span>
                        </h4>
                        <ul class="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                            ${evt.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}
                        </ul>
                    </div>
                </div>

                <!-- Right: Collaborative Cross-Validation (RF08) & Agent Moderation (RF11) -->
                <div class="lg:col-span-5 space-y-4">
                    <!-- RF08: Citizen Cross-Validation Box -->
                    <div class="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                        <div class="flex items-center justify-between">
                            <h4 class="text-sm font-bold text-white flex items-center gap-1.5">
                                <i class="fa-solid fa-people-group text-indigo-400"></i>
                                <span>Validação Cruzada Comunitária (RF08)</span>
                            </h4>
                            <span class="text-xs font-mono text-emerald-400">+15% NC / confirmação</span>
                        </div>
                        <p class="text-xs text-slate-400">
                            Você está num raio de 500m desta ocorrência? Confirme abaixo para atualizar dinamicamente o Nível de Confiança (RN01) e o Score de Risco (RN02):
                        </p>
                        ${isFinalState(evt.state) ? `
                        <p class="text-xs text-slate-300"><i class="fa-solid fa-lock mr-1"></i>Evento em estado final: não recebe novas confirmações nem indicações.</p>
                        ` : `
                        <div class="grid grid-cols-2 gap-2.5 pt-1">
                            <button type="button" data-action="confirm" data-id="${esc(evt.id)}" class="py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-thumbs-up"></i>
                                <span>Eu Também Vejo (+15%)</span>
                            </button>
                            <button type="button" data-action="normalize" data-id="${esc(evt.id)}" class="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-flag-checkered"></i>
                                <span>Já Normalizou</span>
                            </button>
                        </div>
                        `}
                        ${normalizationCount ? `
                            <p class="text-xs text-slate-300">
                                <i class="fa-solid fa-flag-checkered text-slate-400 mr-1"></i>
                                ${esc(normalizationCount)} indicação(ões) de normalização registrada(s) nesta sessão.
                                O encerramento depende de validação da Defesa Civil / CCO.
                            </p>
                        ` : ''}
                    </div>

                    <!-- RF11: Local Agent Operational Moderation Panel -->
                    <div class="p-5 rounded-2xl bg-slate-950 border ${persona.isAgent ? 'border-amber-500/50' : 'border-slate-800'} space-y-3">
                        <div class="flex items-center justify-between">
                            <h4 class="text-sm font-bold text-white flex items-center gap-1.5">
                                <i class="fa-solid fa-user-gear text-amber-400"></i>
                                <span>Moderação de Agente Local / CCO (RF11)</span>
                            </h4>
                            <span class="px-2 py-0.5 rounded text-[11px] font-semibold ${persona.isAgent ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}">
                                ${persona.isAgent ? 'Perfil institucional' : 'Indisponível para Moradora'}
                            </span>
                        </div>
                        ${persona.isAgent ? `
                        <p class="text-xs text-slate-400">
                            Controles demonstrativos para a Defesa Civil (Cap. Roberto) e Concessionárias (Eng. Lucas) transicionarem o estado do evento.
                            Restrição apenas de interface — o protótipo não tem autenticação real.
                        </p>
                        ${allowed.length ? '' : '<p class="text-xs text-slate-300"><i class="fa-solid fa-lock mr-1"></i>Evento em estado final: nenhuma ação de moderação disponível.</p>'}
                        <div class="grid grid-cols-2 gap-2">
                            ${allowed.includes('Alerta Emitido') ? `<button type="button" data-action="state" data-id="${esc(evt.id)}" data-state="Alerta Emitido" data-official="true" class="py-2 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold transition">
                                <i class="fa-solid fa-shield-check mr-1"></i> Validar Oficial (NC 95%)
                            </button>` : ''}
                            ${allowed.includes('Em Monitoramento') ? `<button type="button" data-action="state" data-id="${esc(evt.id)}" data-state="Em Monitoramento" data-official="false" class="py-2 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-semibold transition">
                                <i class="fa-solid fa-eye mr-1"></i> Em Monitoramento
                            </button>` : ''}
                            ${allowed.includes('Encerrado') ? `<button type="button" data-action="state" data-id="${esc(evt.id)}" data-state="Encerrado" data-official="false" class="py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition">
                                <i class="fa-solid fa-check-circle mr-1"></i> Encerrar Evento
                            </button>` : ''}
                            ${allowed.includes('Descartado') ? `<button type="button" data-action="state" data-id="${esc(evt.id)}" data-state="Descartado" data-official="false" class="py-2 px-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-semibold transition">
                                <i class="fa-solid fa-ban mr-1"></i> Descartar (RN04)
                            </button>` : ''}
                        </div>
                        ` : `
                        <p class="text-xs text-slate-400">
                            <i class="fa-solid fa-lock mr-1"></i>
                            Validação oficial, monitoramento, encerramento e descarte são exclusivos de perfis institucionais.
                            Para demonstrar, selecione Cap. Roberto (Defesa Civil) ou Eng. Lucas (CCO) na Tela 1.
                            Restrição apenas de interface — o protótipo não tem autenticação real.
                        </p>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
}

let currentEventId = getEventIdFromUrl();

function render() {
    fillEventSelector(document.getElementById('detailEventSelector'), currentEventId);
    const evt = state.findEvent(currentEventId);
    document.getElementById('eventDetailContainer').innerHTML = evt ? detailHtml(evt) : emptyStateHtml(currentEventId);
}

export function init() {
    document.getElementById('detailEventSelector').addEventListener('change', e => {
        currentEventId = e.target.value;
        setEventIdInUrl(currentEventId);
        render();
    });
    bindEventActions(document.getElementById('eventDetailContainer'));
    render();
    return { refresh: render };
}
