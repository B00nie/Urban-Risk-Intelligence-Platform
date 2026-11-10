// Tela 7 (notificacoes.html): central de notificações e push simulado (RF09, RNF01, RNF03).
import * as state from '../core/state.js';
import { calculateRiskScoreRN02 } from '../core/rules.js';
import { getSourceMeta } from '../core/data.js';
import { triggerSimulatedEmergencyPush, markAllNotificationsRead } from '../core/actions.js';
import { eventUrl } from '../components/eventPicker.js';
import { esc } from '../core/escape.js';

const kindPrefix = {
    zona: 'Alerta na zona monitorada',
    push: 'Push simulado',
    sensor: 'Telemetria IoT simulada',
    relato: 'Relato comunitário confirmado',
    confirmacao: 'Alerta confirmado pela comunidade',
    validacao: 'Alerta validado por agente local'
};

function renderNotifications() {
    const container = document.getElementById('notificationsContainer');
    const notifications = state.getNotifications();
    if (!notifications.length) {
        container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">Nenhuma notificação registrada.</div>`;
        return;
    }

    container.innerHTML = notifications.map(n => {
        const evt = state.findEvent(n.eventId);
        if (!evt) {
            // Defesa: nunca exibir link para evento ausente do conjunto carregado.
            return `<div class="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 text-xs text-slate-400">${esc(n.id)}: evento ${esc(n.eventId)} indisponível no conjunto carregado.</div>`;
        }
        const calc = calculateRiskScoreRN02(evt);
        const src = getSourceMeta(evt.sourceType);
        const isCrit = calc.band === 'CRITICO';
        const borderClass = n.unread
            ? (isCrit ? 'border-red-500/60 bg-red-950/20' : 'border-indigo-500/50 bg-indigo-950/20')
            : 'border-slate-800 bg-slate-950/60 opacity-80';

        return `
            <div class="p-4 rounded-2xl border ${borderClass} transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div class="space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                        ${n.unread ? '<span class="px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[11px] font-bold">NOVO</span>' : ''}
                        <span class="px-2 py-0.5 rounded text-[11px] font-bold border ${calc.badgeClass}">
                            ${calc.label} • Score ${calc.score}
                        </span>
                        <span class="px-2 py-0.5 rounded text-[11px] font-mono border ${calc.sealClass}">
                            Confiança ${calc.nc}% (${calc.sealLabel})
                        </span>
                        <span class="px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-700 bg-slate-800/80 text-slate-200"><i class="fa-solid ${src.icon} mr-1" aria-hidden="true"></i>Origem: ${src.label}</span>
                        <span class="text-xs text-indigo-300 font-medium">
                            <i class="fa-solid fa-location-crosshairs mr-1"></i>${esc(n.zoneMatched)}
                        </span>
                        <span class="text-xs text-slate-400 font-mono">${esc(n.time)}</span>
                    </div>
                    <h4 class="font-bold text-sm text-white pt-1">${esc(kindPrefix[n.kind] || 'Aviso')}: ${esc(evt.title)}</h4>
                    <p class="text-xs text-slate-300">
                        Estado: ${esc(evt.state)} • Origem: ${esc(evt.sourceName)}.
                        ${esc(evt.recommendations?.[0])}
                    </p>
                </div>

                <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <a href="${esc(eventUrl('painel.html', n.eventId))}" data-read="${esc(n.id)}" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold transition">
                        <i class="fa-solid fa-map-location-dot mr-1" aria-hidden="true"></i>Ver no mapa
                    </a>
                    <a href="${esc(eventUrl('detalhes.html', n.eventId))}" data-read="${esc(n.id)}" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition">
                        Ver Alerta (Tela 4)
                    </a>
                    <a href="${esc(eventUrl('confianca.html', n.eventId))}" data-read="${esc(n.id)}" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-semibold transition">
                        Origem (Tela 5)
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

export function init() {
    // Abrir uma notificação a marca como lida antes da navegação (sem re-renderizar a lista).
    document.getElementById('notificationsContainer').addEventListener('click', e => {
        const link = e.target.closest('[data-read]');
        if (link) state.markNotificationsRead(n => n.id === link.dataset.read);
    });
    document.getElementById('btnSimulatePush').addEventListener('click', triggerSimulatedEmergencyPush);
    document.getElementById('btnMarkAllRead').addEventListener('click', markAllNotificationsRead);
    renderNotifications();
    return { refresh: renderNotifications };
}
