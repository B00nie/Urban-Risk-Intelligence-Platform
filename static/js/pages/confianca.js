// Tela 5 (confianca.html): origem do dado e memória de cálculo da RN01 e da RN02 (RF06).
// O evento vem de ?evento=ID; sem evento válido, mostra o estado vazio com seletor.
import * as state from '../core/state.js';
import { calculateRiskScoreRN02, confidenceBreakdownRN01 } from '../core/rules.js';
import { isFinalState } from '../core/data.js';
import { getEventIdFromUrl, setEventIdInUrl, fillEventSelector, emptyStateHtml, bindEventActions } from '../components/eventPicker.js';
import { esc } from '../core/escape.js';

function trustHtml(evt) {
    const persona = state.getPersona();
    const calc = calculateRiskScoreRN02(evt);

    // Componentes da RN01 vêm do motor de regras (a fórmula não é repetida aqui).
    const { base: baseWeight, mediaBonus, communityBonus: commBonus, floorApplied } = confidenceBreakdownRN01(evt);
    const convergenceText = floorApplied
        ? 'Ativo (Eleva piso para 95%)'
        : 'Não aplicável neste evento';

    return `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <!-- Left Column: Source Provenance & RN01 Breakdown -->
            <div class="lg:col-span-7 space-y-5">
                <div class="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-mono uppercase tracking-wider text-emerald-400">Auditoria da Fonte Primária (RF06)</span>
                        <span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${calc.sealClass}">
                            ${calc.nc}% • ${calc.sealLabel}
                        </span>
                    </div>

                    <h3 class="text-lg font-bold text-white">${esc(evt.title)} (${esc(evt.neighborhood)})</h3>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                            <div class="text-slate-400">Canal de Ingestão</div>
                            <div class="font-bold text-white mt-1">
                                ${evt.sourceType === 'PUBLIC_API' ? 'Base Pública Oficial (REST)' : evt.sourceType === 'IOT_SENSOR' ? 'Sensor Urbano IoT (MQTT na arquitetura-alvo)' : 'Registro Comunitário (App)'}
                            </div>
                        </div>
                        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                            <div class="text-slate-400">Identificador da Origem</div>
                            <div class="font-bold text-indigo-300 mt-1">${esc(evt.sourceName)}</div>
                        </div>
                        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                            <div class="text-slate-400">Proteção LGPD (RN03)</div>
                            <div class="font-bold text-emerald-400 mt-1">Hash Anônimo + GPS 100m</div>
                        </div>
                    </div>

                    <!-- Progress Bar of Confidence -->
                    <div class="space-y-1.5 pt-2">
                        <div class="flex justify-between text-xs">
                            <span class="text-slate-300 font-semibold">Índice Consolidado de Confiança do Dado (NC):</span>
                            <span class="font-mono font-bold text-emerald-400">${calc.nc}% / 100%</span>
                        </div>
                        <div class="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500" style="width: ${calc.nc}%"></div>
                        </div>
                        <div class="flex justify-between text-[11px] font-mono text-slate-400">
                            <span>0% (Retido)</span>
                            <span>50% (Limiar de Confirmação)</span>
                            <span>75% (Alta Confiança)</span>
                            <span>100%</span>
                        </div>
                    </div>
                </div>

                <!-- Step-by-Step Mathematical Table of RN01 -->
                <div class="p-5 rounded-2xl bg-slate-950 border border-slate-800">
                    <h4 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <i class="fa-solid fa-calculator text-emerald-400"></i>
                        <span>Memória de Cálculo Determinística — Nível de Confiança (RN01)</span>
                    </h4>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr class="border-b border-slate-800 text-slate-400">
                                    <th class="py-2 pr-3">Componente da Regra RN01</th>
                                    <th class="py-2 px-3">Critério Aplicado</th>
                                    <th class="py-2 pl-3 text-right">Peso / Impacto</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-800/70 text-slate-200">
                                <tr>
                                    <td class="py-2.5 pr-3 font-medium">1. Peso Base da Fonte (P<sub class="text-[11px]">origem</sub>)</td>
                                    <td class="py-2.5 px-3 text-slate-400">${evt.sourceType === 'PUBLIC_API' ? 'Base Pública Oficial (85%)' : evt.sourceType === 'IOT_SENSOR' ? 'Sensor IoT Calibrado (80%)' : 'Relato Comunitário Único (35%)'}</td>
                                    <td class="py-2.5 pl-3 text-right font-mono font-bold text-white">+${baseWeight}%</td>
                                </tr>
                                <tr>
                                    <td class="py-2.5 pr-3 font-medium">2. Mídia com Metadados EXIF</td>
                                    <td class="py-2.5 px-3 text-slate-400">${evt.hasExifMedia ? 'Foto georreferenciada validada' : 'Sem anexo fotográfico'}</td>
                                    <td class="py-2.5 pl-3 text-right font-mono font-bold text-emerald-400">+${mediaBonus}%</td>
                                </tr>
                                <tr>
                                    <td class="py-2.5 pr-3 font-medium">3. Confirmações Vizinhos (Raio 500m)</td>
                                    <td class="py-2.5 px-3 text-slate-400">${esc(evt.communityConfirmations)} confirmação(ões) &times; 15% (Teto 45%)</td>
                                    <td class="py-2.5 pl-3 text-right font-mono font-bold text-emerald-400">+${commBonus}%</td>
                                </tr>
                                <tr>
                                    <td class="py-2.5 pr-3 font-medium">4. Convergência Sensor / Agente</td>
                                    <td class="py-2.5 px-3 text-slate-400">${convergenceText}</td>
                                    <td class="py-2.5 pl-3 text-right font-mono font-bold text-indigo-300">${floorApplied ? '&ge; 95%' : '0%'}</td>
                                </tr>
                                <tr class="bg-slate-900/90 font-bold text-white">
                                    <td class="py-3 pl-2" colspan="2">Nível de Confiança Final Consolidado (Teto 100%)</td>
                                    <td class="py-3 pr-2 text-right font-mono text-base text-emerald-400">${calc.nc}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Right Column: RN02 Risk Priority Formula & Interactive What-If Simulator -->
            <div class="lg:col-span-5 space-y-5">
                <div class="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                    <h4 class="text-sm font-bold text-white flex items-center gap-2">
                        <i class="fa-solid fa-scale-balanced text-amber-400"></i>
                        <span>Cálculo do Score de Priorização de Risco (RN02)</span>
                    </h4>

                    <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-indigo-300">
                        Score = [(S &times; 15) + (I &times; 10)] &times; (NC / 100)
                    </div>

                    <div class="space-y-2 text-xs">
                        <div class="flex justify-between py-1.5 border-b border-slate-800">
                            <span class="text-slate-400">Severidade do Fenômeno (S, de 1 a 4):</span>
                            <span class="font-mono font-bold text-white">Nível ${esc(evt.severity)} &rarr; ${evt.severity * 15} pts</span>
                        </div>
                        <div class="flex justify-between py-1.5 border-b border-slate-800">
                            <span class="text-slate-400">Impacto Populacional/Urbano (I, de 1 a 4):</span>
                            <span class="font-mono font-bold text-white">Nível ${esc(evt.impact)} &rarr; ${evt.impact * 10} pts</span>
                        </div>
                        <div class="flex justify-between py-1.5 border-b border-slate-800">
                            <span class="text-slate-400">Soma Base Bruta (S &times; 15 + I &times; 10):</span>
                            <span class="font-mono font-bold text-slate-200">${calc.rawPoints} pts</span>
                        </div>
                        <div class="flex justify-between py-1.5 border-b border-slate-800">
                            <span class="text-slate-400">Ponderação pelo Nível de Confiança (&times; ${calc.nc}%):</span>
                            <span class="font-mono font-bold text-emerald-400">${calc.rawPoints} &times; ${(calc.nc / 100).toFixed(2)}</span>
                        </div>
                        <div class="flex justify-between items-center pt-2">
                            <span class="font-bold text-white">Classificação Final de Prioridade:</span>
                            <span class="px-3 py-1 rounded-lg font-mono font-bold text-xs border ${calc.badgeClass}">
                                ${calc.score} pts • ${calc.label}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Interactive Calibration Actions for Demonstration -->
                <div class="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 class="text-sm font-bold text-white flex items-center gap-2">
                        <i class="fa-solid fa-sliders text-indigo-400"></i>
                        <span>Testar Validação Cruzada ao Vivo neste Dado</span>
                    </h4>
                    <p class="text-xs text-slate-400">
                        Demonstre no vídeo (Entregável 6) como uma nova confirmação comunitária ou validação da Defesa Civil recalcula a confiança e a prioridade em tempo real:
                    </p>
                    <div class="flex flex-col gap-2 pt-1">
                        ${isFinalState(evt.state) ? `
                        <p class="text-xs text-slate-300"><i class="fa-solid fa-lock mr-1"></i>Evento em estado final: não recebe novas confirmações nem validação oficial.</p>
                        ` : `
                        <button type="button" data-action="confirm" data-id="${esc(evt.id)}" class="w-full py-2.5 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition flex items-center justify-between">
                            <span>+ Simular Confirmação de Vizinho num Raio de 500m</span>
                            <span class="font-mono">+15% NC</span>
                        </button>
                        `}
                        ${isFinalState(evt.state) ? '' : persona.isAgent ? `
                        <button type="button" data-action="state" data-id="${esc(evt.id)}" data-state="Alerta Emitido" data-official="true" class="w-full py-2.5 px-4 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition flex items-center justify-between">
                            <span>+ Chancela Oficial Defesa Civil / CCO</span>
                            <span class="font-mono">Eleva p/ 95%</span>
                        </button>
                        ` : `
                        <p class="text-xs text-slate-400"><i class="fa-solid fa-lock mr-1"></i>Chancela oficial disponível apenas para perfis institucionais (Tela 1).</p>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
}

let currentEventId = getEventIdFromUrl();

function render() {
    fillEventSelector(document.getElementById('trustEventSelector'), currentEventId);
    const evt = state.findEvent(currentEventId);
    document.getElementById('trustAuditContainer').innerHTML = evt ? trustHtml(evt) : emptyStateHtml(currentEventId);
}

export function init() {
    document.getElementById('trustEventSelector').addEventListener('change', e => {
        currentEventId = e.target.value;
        setEventIdInUrl(currentEventId);
        render();
    });
    bindEventActions(document.getElementById('trustAuditContainer'));
    render();
    return { refresh: render };
}
