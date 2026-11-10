// Tela 2 (painel.html): indicadores, mapa georreferenciado e fila prioritária (RF02, RF03, RF12, RNF01).
// Única página que carrega o Leaflet (global L, script clássico no <head> do painel.html).
import * as state from '../core/state.js';
import { calculateConfidenceRN01, calculateRiskScoreRN02 } from '../core/rules.js';
import { getCategoryMeta, isFinalState } from '../core/data.js';
import { eventUrl, getEventIdFromUrl } from '../components/eventPicker.js';
import { esc } from '../core/escape.js';

let selectedMapCategory = 'ALL';
let mapInstance = null;
let mapMarkersLayer = null;
const markersById = new Map();
// Evento pedido por painel.html?evento=ID; não altera nenhum dado, só o que o mapa mostra.
const focusedEventId = getEventIdFromUrl() || null;

const CATEGORIES = ['ALAGAMENTO', 'CALOR', 'ENERGIA', 'AGUA', 'TRANSPORTE'];
const MAP_FILTER_LABELS = { ALAGAMENTO: 'Alagamentos', CALOR: 'Ilhas de Calor', SERVICOS: 'Energia / Água / Transporte' };

// Ativa = qualquer estado que não seja final (Encerrado ou Descartado), inclusive Em Validação.
const getActiveEvents = () => state.getEvents().filter(e => !isFinalState(e.state));

function matchesMapFilter(evt) {
    if (selectedMapCategory === 'ALL') return true;
    if (selectedMapCategory === 'SERVICOS') return ['ENERGIA', 'AGUA', 'TRANSPORTE'].includes(evt.category);
    return evt.category === selectedMapCategory;
}

function showMapNotice(message) {
    const notice = document.getElementById('mapNotice');
    notice.textContent = message;
    notice.classList.remove('hidden');
}

function initMap() {
    if (mapInstance) return;
    try {
        mapInstance = L.map('urbanMap', { zoomControl: false }).setView([-23.5641, -46.6388], 12);
        // Em telas estreitas o popup ocupa toda a largura do mapa: o zoom desce para não ficar sobre ele.
        L.control.zoom({ position: window.innerWidth < 640 ? 'bottomleft' : 'topleft' }).addTo(mapInstance);
        // Provisório (Etapa 2): tiles padrão do OpenStreetMap, sem chave, até a etapa do Google Maps.
        // Uso interativo comum, sem prefetch nem download em massa (https://operations.osmfoundation.org/policies/tiles/).
        const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(mapInstance);
        tiles.once('tileerror', () => showMapNotice('Parte do mapa base (OpenStreetMap) não carregou. Verifique a conexão; marcadores, indicadores e a fila prioritária continuam disponíveis.'));
        mapMarkersLayer = L.layerGroup().addTo(mapInstance);
    } catch (err) {
        console.warn('Fallback de mapa ativado:', err);
        showMapNotice('Mapa indisponível: a biblioteca Leaflet não carregou (verifique a conexão). Indicadores e fila prioritária continuam disponíveis abaixo.');
    }
}

function setMapCategoryFilter(cat) {
    selectedMapCategory = cat;
    document.querySelectorAll('[data-map-filter]').forEach(btn => {
        const selected = btn.dataset.mapFilter === cat;
        btn.className = selected
            ? 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white transition flex items-center gap-1.5'
            : 'px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5';
        btn.setAttribute('aria-pressed', String(selected));
    });
    renderMapMarkers();
}

function renderMapMarkers() {
    updateGlobalKPIs();

    const active = getActiveEvents();
    renderCategoryCounters(active);
    const filtered = active
        .filter(matchesMapFilter)
        .sort((a, b) => calculateRiskScoreRN02(b).score - calculateRiskScoreRN02(a).score);

    // Render Map Pins & 500m Cross-Validation Circles
    if (mapInstance && mapMarkersLayer) {
        mapMarkersLayer.clearLayers();
        markersById.clear();
        filtered.forEach(evt => {
            const calc = calculateRiskScoreRN02(evt);
            const meta = getCategoryMeta(evt.category);

            // 500m Impact & Cross-Validation Radius Circle
            L.circle([evt.lat, evt.lng], {
                color: calc.colorHex,
                fillColor: calc.colorHex,
                fillOpacity: 0.16,
                weight: 1.5,
                radius: 500
            }).addTo(mapMarkersLayer);

            // Custom HTML Marker Pin
            const pulseClass = calc.band === 'CRITICO' ? 'critical-pulse' : '';
            const customIcon = L.divIcon({
                className: 'custom-risk-pin',
                html: `
                    <div class="relative flex items-center justify-center w-9 h-9 rounded-full border-2 border-white shadow-lg ${pulseClass}" style="background-color: ${calc.colorHex};">
                        <i class="fa-solid ${meta.icon} text-white text-xs" aria-hidden="true"></i>
                        <span class="absolute -bottom-1.5 -right-2 px-1 rounded bg-slate-950 border border-white/80 text-[11px] font-bold leading-tight text-white">${calc.priorityCode}</span>
                    </div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });

            const marker = L.marker([evt.lat, evt.lng], { icon: customIcon, title: evt.title, zIndexOffset: calc.score * 10 /* maior prioridade por cima */ }).addTo(mapMarkersLayer);
            markersById.set(evt.id, marker);
            // Links reais (o "!" do Tailwind evita que a cor padrão de links do Leaflet sobrescreva o texto).
            marker.bindPopup(`
                <div class="p-1">
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <span class="px-2 py-0.5 rounded text-[11px] font-bold uppercase" style="background:${calc.colorHex}33; color:${calc.colorHex}; border:1px solid ${calc.colorHex}66;">
                            ${calc.label} • Score ${calc.score}
                        </span>
                        <span class="text-[11px] font-mono text-emerald-400">Confiança: ${calc.nc}%</span>
                    </div>
                    <div class="font-bold text-xs text-white mt-1">${esc(evt.title)}</div>
                    <div class="text-xs text-slate-300 mt-0.5">${esc(evt.neighborhood)}</div>
                    <div class="text-[11px] text-slate-400 mt-1"><strong>Origem:</strong> ${esc(evt.sourceName)}</div>
                    <div class="text-[11px] text-indigo-300 mt-0.5"><strong>Estado UML:</strong> ${esc(evt.state)}</div>
                    <div class="mt-2.5 pt-2 border-t border-slate-700 flex flex-wrap items-center justify-between gap-2">
                        <a href="${esc(eventUrl('detalhes.html', evt.id))}" class="px-2 py-1 rounded bg-indigo-600 !text-white text-[11px] font-semibold">
                            Ver Detalhes (Tela 4)
                        </a>
                        <a href="${esc(eventUrl('confianca.html', evt.id))}" class="px-2 py-1 rounded bg-emerald-600/30 border border-emerald-500/40 !text-emerald-300 text-[11px] font-semibold">
                            Auditar Confiança (Tela 5)
                        </a>
                    </div>
                </div>
            `, {
                // Cabe no mapa em telas estreitas (56 px = margens do popup do Leaflet + folga) e não fica sob os botões de zoom.
                maxWidth: Math.min(300, mapInstance.getSize().x - 56),
                autoPanPaddingTopLeft: [5, 80]
            });
        });
    }

    // Fila prioritária ao lado do mapa
    const sidebar = document.getElementById('mapSidebarList');
    sidebar.innerHTML = filtered.map(evt => {
        const calc = calculateRiskScoreRN02(evt);
        const meta = getCategoryMeta(evt.category);
        return `
            <a href="${esc(eventUrl('detalhes.html', evt.id))}" ${evt.id === focusedEventId ? 'data-focused="true"' : ''} class="block p-3 rounded-xl hover:bg-slate-800/90 border transition cursor-pointer ${evt.id === focusedEventId ? 'bg-indigo-950/40 border-indigo-400' : 'bg-slate-900 border-slate-800'}">
                <div class="flex items-center justify-between gap-2">
                    <span class="whitespace-nowrap px-2 py-0.5 rounded text-[11px] font-bold border ${calc.badgeClass}">
                        ${calc.priorityCode} • Score ${calc.score}
                    </span>
                    <span class="whitespace-nowrap px-2 py-0.5 rounded text-[11px] font-mono border ${calc.sealClass}">
                        <i class="fa-solid fa-shield-halved mr-1" aria-hidden="true"></i>${calc.nc}% Confiança
                    </span>
                </div>
                <h4 class="font-semibold text-xs text-white mt-2 flex items-center gap-1.5">
                    <i class="fa-solid ${meta.icon} ${meta.color}"></i>
                    <span>${esc(evt.title)}</span>
                </h4>
                <div class="flex items-center justify-between text-xs text-slate-400 mt-1">
                    <span>${esc(evt.neighborhood)}</span>
                    <span class="text-indigo-300 font-medium">${esc(evt.state)}</span>
                </div>
            </a>
        `;
    }).join('');

    document.getElementById('mapFilterStatus').textContent = selectedMapCategory === 'ALL'
        ? `Mapa e fila: todas as ${active.length} ocorrências ativas.`
        : `Mapa e fila filtrados por ${MAP_FILTER_LABELS[selectedMapCategory]}: ${filtered.length} de ${active.length} ocorrências ativas.`;
    updateFocusNotice();
}

// Totais gerais do conjunto carregado: não mudam com o filtro do mapa. Categoria não é origem do dado (ver "Eventos por Origem").
function renderCategoryCounters(active) {
    document.getElementById('categoryCounters').innerHTML = `
        <section class="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6" aria-labelledby="categoryCountersTitle">
            <h3 id="categoryCountersTitle" class="text-sm font-bold text-white">Ocorrências ativas por categoria</h3>
            <p class="text-xs text-slate-400 mt-0.5 mb-3">Total geral: ${active.length}, sem efeito do filtro do mapa. Ativa é qualquer estado, exceto Encerrado e Descartado.</p>
            <dl class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                ${CATEGORIES.map(cat => {
                    const meta = getCategoryMeta(cat);
                    const count = active.filter(e => e.category === cat).length;
                    return `
                        <div data-category-count="${cat}" class="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center gap-2.5">
                            <i class="fa-solid ${meta.icon} ${meta.color} w-4 text-center" aria-hidden="true"></i>
                            <div class="min-w-0">
                                <dt class="text-xs text-slate-400 leading-snug">${meta.name}</dt>
                                <dd class="text-lg font-bold leading-tight ${count ? 'text-white' : 'text-slate-400'}">${count}</dd>
                            </div>
                        </div>
                    `;
                }).join('')}
            </dl>
        </section>
    `;
}

function showFocusNotice(message, warning, action) {
    const box = document.getElementById('mapFocusNotice');
    const warn = ['bg-amber-950/40', 'border-amber-500/40', 'text-amber-200'];
    const info = ['bg-indigo-950/40', 'border-indigo-500/40', 'text-indigo-200'];
    box.classList.remove('hidden', ...warn, ...info);
    box.classList.add(...(warning ? warn : info));
    const text = document.createElement('span');
    text.textContent = message; // o ID vem da URL: nunca entra como HTML
    box.replaceChildren(text);
    if (action) box.append(action);
}

function focusAction(tag, label) {
    const el = document.createElement(tag);
    el.className = 'shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold transition';
    el.textContent = label;
    return el;
}

function detailsLink(evt) {
    const link = focusAction('a', 'Ver detalhes (Tela 4)');
    link.href = eventUrl('detalhes.html', evt.id);
    return link;
}

function updateFocusNotice() {
    if (!focusedEventId) return;
    const evt = state.findEvent(focusedEventId);
    if (!evt) {
        showFocusNotice(`Ocorrência "${focusedEventId}" não encontrada no conjunto carregado. O restante do painel continua disponível.`, true);
    } else if (isFinalState(evt.state)) {
        showFocusNotice(`${evt.id} está em "${evt.state}" e não aparece no mapa, que mostra só ocorrências ativas.`, true, detailsLink(evt));
    } else if (!matchesMapFilter(evt)) {
        const showAll = focusAction('button', 'Mostrar todos');
        showAll.type = 'button';
        showAll.addEventListener('click', () => {
            setMapCategoryFilter('ALL');
            focusEventOnMap();
        });
        showFocusNotice(`O filtro atual oculta ${evt.id}: ${evt.title}.`, true, showAll);
    } else if (!mapInstance) {
        showFocusNotice(`O mapa não está disponível para localizar ${evt.id}: ${evt.title}.`, true, detailsLink(evt));
    } else {
        showFocusNotice(`Ocorrência em destaque no mapa: ${evt.id}: ${evt.title}.`, false);
    }
}

// Centraliza o mapa no evento pedido e abre o popup dele. Só roda com mapa e dados prontos (ver init).
function focusEventOnMap() {
    const evt = state.findEvent(focusedEventId);
    const marker = markersById.get(focusedEventId);
    if (!evt || !marker) return;
    mapInstance.setView([evt.lat, evt.lng], Math.max(mapInstance.getZoom(), 14), { animate: false });
    marker.openPopup();
    const item = document.querySelector('#mapSidebarList [data-focused]');
    if (item) item.parentElement.scrollTop = item.offsetTop - item.parentElement.offsetTop;
}

function updateGlobalKPIs() {
    const events = state.getEvents();
    const active = getActiveEvents();
    const criticalCount = active.filter(e => calculateRiskScoreRN02(e).band === 'CRITICO').length;
    const avgConf = active.length
        ? Math.round(active.reduce((acc, e) => acc + calculateConfidenceRN01(e), 0) / active.length)
        : 0;

    document.getElementById('kpiTotalActive').textContent = active.length;
    document.getElementById('kpiCriticalCount').textContent = criticalCount;
    document.getElementById('kpiAvgConfidence').textContent = `${avgConf}%`;

    const bySource = type => events.filter(e => e.sourceType === type).length;
    document.getElementById('kpiSourceTotal').textContent = events.length;
    document.getElementById('kpiSourceBreakdown').textContent =
        `${bySource('IOT_SENSOR')} sensor IoT • ${bySource('PUBLIC_API')} base pública • ${bySource('COMMUNITY')} comunidade`;
}

export function init() {
    initMap();
    document.querySelectorAll('[data-map-filter]').forEach(btn => {
        btn.addEventListener('click', () => setMapCategoryFilter(btn.dataset.mapFilter));
    });
    setMapCategoryFilter(selectedMapCategory);
    // Recalcula o tamanho depois que cabeçalho e barra lateral terminam de ocupar o layout.
    requestAnimationFrame(() => {
        mapInstance?.invalidateSize();
        if (!focusedEventId) return;
        focusEventOnMap();
        (markersById.has(focusedEventId) ? document.getElementById('urbanMap') : document.getElementById('mapFocusNotice')).scrollIntoView({ block: 'center' });
    });
    return { refresh: renderMapMarkers };
}
