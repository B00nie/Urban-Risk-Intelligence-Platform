// Tela 1 (index.html): seleção de persona e consentimento LGPD (RF01, RNF05, RN03).
import * as state from '../core/state.js';
import { showToast } from '../components/toast.js';

const CARD_SELECTED = 'cursor-pointer p-4 rounded-xl border-2 border-indigo-500 bg-indigo-950/30 transition flex items-start gap-4';
const CARD_IDLE = 'cursor-pointer p-4 rounded-xl border border-slate-800 bg-slate-800/40 hover:border-slate-700 transition flex items-start gap-4';
const CONSENT_INPUTS = { geo: 'lgpdConsentGeo', anon: 'lgpdConsentAnon', push: 'lgpdConsentPush' };

function render() {
    const current = state.getPersona().id;
    document.querySelectorAll('[data-persona]').forEach(card => {
        const selected = card.dataset.persona === current;
        card.className = selected ? CARD_SELECTED : CARD_IDLE;
        card.setAttribute('aria-pressed', String(selected));
    });
    const consents = state.getConsents();
    Object.entries(CONSENT_INPUTS).forEach(([key, id]) => {
        document.getElementById(id).checked = consents[key];
    });
}

function selectPersona(personaId) {
    state.setPersona(personaId);
    state.emitChange();
    const persona = state.getPersona();
    showToast(`Perfil ativo alterado para ${persona.name} (${persona.role}).`, 'info');
}

function confirmLoginAndProceed() {
    const consents = state.getConsents();
    if (!consents.geo || !consents.anon) {
        showToast('Para prosseguir em conformidade com a LGPD (RF01), aceite a Geolocalização Truncada e a Anonimização na Origem.', 'warning');
        return;
    }
    state.setFlash(`Consentimento registrado nesta sessão (demonstração) para ${state.getPersona().name}.`, 'success');
    window.location.href = 'painel.html';
}

export function init() {
    document.querySelectorAll('[data-persona]').forEach(card => {
        card.addEventListener('click', () => selectPersona(card.dataset.persona));
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectPersona(card.dataset.persona);
            }
        });
    });
    Object.entries(CONSENT_INPUTS).forEach(([key, id]) => {
        document.getElementById(id).addEventListener('change', e => state.setConsent(key, e.target.checked));
    });
    document.getElementById('btnEnterPlatform').addEventListener('click', confirmLoginAndProceed);
    render();
    return { refresh: render };
}
