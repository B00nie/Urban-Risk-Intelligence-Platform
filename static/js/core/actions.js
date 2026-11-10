// Operações de domínio da demonstração (RF07, RF08, RF09, RF10, RF11).
// Alteram o estado, gravam na API quando ela está conectada e avisam as telas por state.emitChange().
import * as state from './state.js';
import { syncEvent } from './api.js';
import { calculateConfidenceRN01, calculateRiskScoreRN02, NC_LIMIAR_CONFIRMACAO } from './rules.js';
import { ACTIVE_ALERT_STATES, allowedTransitions, isFinalState } from './data.js';
import { showToast } from '../components/toast.js';

// --- Notificações ---------------------------------------------------------------------------
// Cada notificação guarda só a referência ao evento; título, prioridade, score, confiança e cor
// são derivados de RN01/RN02 na exibição, para nunca divergirem do evento carregado (API ou JS).

// Zona cujo nome-chave aparece no bairro do evento (ex.: "Centro / Sé (Raio 1km)" -> "Sé").
function findZoneForEvent(evt) {
    return state.getZones().find(z => evt.neighborhood.includes(z.region.split(' (')[0].split(' / ').pop()));
}

function createNotification(evt, kind, time) {
    const zone = findZoneForEvent(evt);
    return {
        id: state.nextNotificationId(),
        eventId: evt.id,
        kind,
        zoneMatched: zone ? `${zone.label} — ${evt.neighborhood}` : `Área do evento — ${evt.neighborhood}`,
        time,
        unread: true
    };
}

// Conjunto inicial: alertas ativos com NC >= 50% (RN01) que caem nas zonas monitoradas.
// Gerado uma vez por modo de dados (API ou local) e depois mantido na sessão.
export function ensureSeedNotifications() {
    if (!state.needsNotificationSeed()) return;
    state.setSeedNotifications(state.getEvents()
        .filter(e => ACTIVE_ALERT_STATES.includes(e.state))
        .filter(e => calculateConfidenceRN01(e) >= NC_LIMIAR_CONFIRMACAO && findZoneForEvent(e))
        .sort((a, b) => calculateRiskScoreRN02(b).score - calculateRiskScoreRN02(a).score)
        .map(e => createNotification(e, 'zona', e.timestamp)));
}

export function markNotificationRead(notifId) {
    state.markNotificationsRead(n => n.id === notifId);
    state.emitChange();
}

export function markAllNotificationsRead() {
    state.markNotificationsRead(() => true);
    state.emitChange();
    showToast('Todas as notificações foram marcadas como lidas.', 'info');
}

// --- Persistência das alterações de eventos -------------------------------------------------
// Modo local: grava na sessão do navegador. Modo API: grava no SQLite e avisa se a API não confirmar.
async function persistEvent(evt, actionType) {
    state.saveEvents();
    if (!state.isApiMode()) return true;
    const ok = await syncEvent(evt, actionType);
    if (!ok) {
        showToast(`A API local não confirmou a gravação de ${evt.id}: a alteração aparece só nesta página e não foi gravada no SQLite.`, 'warning');
    }
    return ok;
}

// --- RF08: validação cruzada e "Já Normalizou" ----------------------------------------------
export async function confirmEventByCommunity(eventId) {
    const evt = state.findEvent(eventId);
    if (!evt) return;
    if (isFinalState(evt.state)) {
        showToast(`O evento ${evt.id} está em "${evt.state}" e não recebe novas confirmações.`, 'warning');
        return;
    }
    evt.communityConfirmations = (evt.communityConfirmations || 0) + 1;

    const newNc = calculateConfidenceRN01(evt);
    const enteredAlert = evt.state === 'Em Validação' && newNc >= NC_LIMIAR_CONFIRMACAO;
    if (enteredAlert) {
        evt.state = 'Alerta Emitido';
        evt.slaEstimate = 'Confirmado por validação cruzada comunitária • Equipes alertadas';
    }

    await persistEvent(evt, 'confirm');
    // RN01: ao atingir NC >= 50% o evento vira alerta e gera comunicado.
    if (enteredAlert) {
        state.addNotification(createNotification(evt, 'confirmacao', 'Agora'));
    }
    state.emitChange();
    showToast(`Confirmação cruzada registrada! Nível de Confiança subiu para ${newNc}% (RN01).`, 'success');
}

// RF08 "Já Normalizou": registra a indicação do morador sem encerrar o evento e sem alterar a confiança
// (não há regra documentada para isso). Encerrar exige perfil institucional (ver PENDENCIAS.md).
// Registro desta sessão do navegador: a API não tem rota para indicações de normalização.
export function reportEventNormalized(eventId) {
    const evt = state.findEvent(eventId);
    if (!evt) return;
    if (isFinalState(evt.state)) {
        showToast(`O evento ${evt.id} já está em "${evt.state}".`, 'warning');
        return;
    }
    state.addNormalization(eventId);
    state.emitChange();
    showToast(`Indicação de normalização registrada para ${evt.id}. O evento continua em "${evt.state}": o encerramento depende de validação da Defesa Civil / CCO.`, 'info');
}

// --- RF11: moderação por agente local -------------------------------------------------------
export async function changeEventState(eventId, newState, validateAsOfficial) {
    // Guarda de interface (não é autorização segura: não há autenticação real no protótipo).
    const persona = state.getPersona();
    if (!persona.isAgent) {
        showToast('Ação restrita a perfis institucionais (Defesa Civil / CCO). Selecione Cap. Roberto ou Eng. Lucas na Tela 1.', 'warning');
        return;
    }
    const evt = state.findEvent(eventId);
    if (!evt) return;
    if (!allowedTransitions(evt.state).includes(newState)) {
        showToast(`Transição não prevista no ciclo de vida: de "${evt.state}" para "${newState}".`, 'warning');
        return;
    }
    const enteredAlert = newState === 'Alerta Emitido' && evt.state !== 'Alerta Emitido';
    evt.state = newState;
    if (validateAsOfficial) {
        evt.agentValidated = true;
    }
    await persistEvent(evt, 'state');
    if (enteredAlert) {
        state.addNotification(createNotification(evt, 'validacao', 'Agora'));
    }
    state.emitChange();
    showToast(`Estado do evento ${evt.id} atualizado para "${newState}" por ${persona.name}.`, 'success');
}

// --- RF07: relato comunitário ---------------------------------------------------------------
// Cria o evento, aplica RN01/RN02 e, com NC >= 50%, gera o comunicado. Retorna o evento e o cálculo.
export async function createCommunityReport({ category, neighborhood, lat, lng, severity, impact, title, description, hasPhoto, hasSensor }) {
    const persona = state.getPersona();
    const newId = `EVT-2026-00${state.getEvents().length + 1}`;
    const newEvt = {
        id: newId,
        title,
        category,
        neighborhood,
        lat: lat + (Math.random() - 0.5) * 0.004,
        lng: lng + (Math.random() - 0.5) * 0.004,
        severity,
        impact,
        sourceType: 'COMMUNITY',
        sourceName: `Relato Comunitário (${persona.hash})${hasSensor ? ' + Sensor IoT' : ''}`,
        baseWeight: 35,
        hasExifMedia: hasPhoto,
        communityConfirmations: 0,
        sensorConvergence: hasSensor,
        agentValidated: persona.isAgent,
        state: 'Reportado',
        timestamp: 'Agora mesmo',
        slaEstimate: 'Processado pelo motor de regras (RN01/RN02)',
        description,
        recommendations: [
            'Acompanhe a evolução do estado operacional na Tela 4.',
            'Mantenha distância segura do perímetro sinalizado no mapa.'
        ]
    };

    const calc = calculateRiskScoreRN02(newEvt);
    newEvt.state = calc.nc >= NC_LIMIAR_CONFIRMACAO ? 'Alerta Emitido' : 'Em Validação';
    newEvt.slaEstimate = calc.nc >= NC_LIMIAR_CONFIRMACAO
        ? 'Alerta emitido (distribuição simulada no navegador)'
        : 'Aguardando confirmação cruzada de moradores num raio de 500m (RN01)';

    state.addEvent(newEvt);
    const synced = await persistEvent(newEvt, 'create');

    // RN01: só gera comunicado com NC >= 50%
    if (calc.nc >= NC_LIMIAR_CONFIRMACAO) {
        state.addNotification(createNotification(newEvt, 'relato', 'Agora mesmo'));
    }
    state.emitChange();
    return { evt: newEvt, calc, synced };
}

// --- RF03 / RF09: simulações de sensor e de push --------------------------------------------
export async function simulateIncomingSensorEvent() {
    const id = `EVT-2026-00${state.getEvents().length + 1}`;
    const sensorEvt = {
        id,
        title: 'Pico Pluviométrico Súbito e Risco de Enxurrada',
        category: 'ALAGAMENTO',
        neighborhood: 'Mooca / Tamanduateí (Zona Leste)',
        lat: -23.5625,
        lng: -46.5990,
        severity: 4,
        impact: 3,
        sourceType: 'IOT_SENSOR',
        sourceName: 'Estação Telemétrica IoT #PLUV-ZL-108 (leitura simulada)',
        baseWeight: 80,
        hasExifMedia: false,
        communityConfirmations: 1,
        sensorConvergence: true,
        agentValidated: false,
        state: 'Reportado',
        timestamp: 'Agora (simulado)',
        slaEstimate: 'Alerta gerado pelo motor de regras a partir de leitura simulada',
        description: 'Sensor acusou precipitação de 62mm/h e elevação rápida do nível do canal. Alerta emitido automaticamente pelo Motor de Regras.',
        recommendations: [
            'Evite a Av. do Estado e vias marginais do Rio Tamanduateí.',
            'Acompanhe o nível da água em tempo real pelo painel.'
        ]
    };

    const calc = calculateRiskScoreRN02(sensorEvt);
    sensorEvt.state = calc.nc >= NC_LIMIAR_CONFIRMACAO ? 'Alerta Emitido' : 'Em Validação';

    state.addEvent(sensorEvt);
    await persistEvent(sensorEvt, 'create');

    if (calc.nc >= NC_LIMIAR_CONFIRMACAO) {
        state.addNotification(createNotification(sensorEvt, 'sensor', 'Agora'));
    }
    state.emitChange();
    showToast(`Leitura de sensor simulada (${id}): ${calc.label}, Score ${calc.score}, Confiança ${calc.nc}%.`, calc.band === 'CRITICO' ? 'critical' : 'warning');
}

// Push simulado para o alerta ativo de maior score; a prioridade exibida vem da RN02 (não é presumida P1).
export function triggerSimulatedEmergencyPush() {
    const topEvent = state.getEvents()
        .filter(e => ACTIVE_ALERT_STATES.includes(e.state) && calculateConfidenceRN01(e) >= NC_LIMIAR_CONFIRMACAO)
        .sort((a, b) => calculateRiskScoreRN02(b).score - calculateRiskScoreRN02(a).score)[0];
    if (!topEvent) {
        showToast('Nenhum alerta ativo com confiança ≥ 50% (RN01) para notificar.', 'warning');
        return;
    }
    const calc = calculateRiskScoreRN02(topEvent);
    state.addNotification(createNotification(topEvent, 'push', 'Agora'));
    state.emitChange();
    showToast(`Push simulado no navegador: ${calc.label}, Score ${calc.score}, Confiança ${calc.nc}% (fila prioritária = arquitetura-alvo).`, calc.band === 'CRITICO' ? 'critical' : 'warning');
}

// --- RF10 / RNF05: zonas monitoradas e Direito ao Esquecimento (só no navegador) -----------
export function addMonitoredZone(label, region) {
    state.setZones([...state.getZones(), { id: `Z-${Date.now()}`, label, region, active: true }]);
    state.emitChange();
    showToast(`Zona "${label} (${region})" salva nesta sessão do navegador (demonstração).`, 'success');
}

export function removeMonitoredZone(id) {
    state.setZones(state.getZones().filter(z => z.id !== id));
    state.emitChange();
    showToast('Zona monitorada removida.', 'info');
}

export function forgetPersonalData() {
    state.setZones([]);
    state.setConsent('geo', false);
    state.setConsent('push', false);
    state.emitChange();
    showToast('Direito ao Esquecimento demonstrado: zonas e consentimentos desta sessão removidos do navegador.', 'critical');
}
