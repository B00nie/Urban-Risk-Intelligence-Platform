// Tela 8 (perfil.html): zonas monitoradas (RF10) e direitos do titular na demonstração LGPD (RNF05).
// Tudo aqui fica só na sessão do navegador; a rota DELETE /api/lgpd/forget/<id> não é acionada.
import * as state from '../core/state.js';
import { addMonitoredZone, removeMonitoredZone, forgetPersonalData } from '../core/actions.js';
import { showToast } from '../components/toast.js';
import { esc } from '../core/escape.js';

let modalOpener = null;

function renderMonitoredZones() {
    const container = document.getElementById('monitoredZonesList');
    if (!state.getZones().length) {
        container.innerHTML = `<p class="p-4 rounded-xl bg-slate-950 border border-dashed border-slate-700 text-sm text-slate-400 text-center">Nenhuma zona monitorada. Adicione uma acima para receber alertas direcionados.</p>`;
        return;
    }
    container.innerHTML = state.getZones().map(z => `
        <div class="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <i class="fa-solid fa-location-dot"></i>
                </div>
                <div>
                    <div class="font-bold text-xs text-white">${esc(z.label)}</div>
                    <div class="text-xs text-slate-400">${esc(z.region)} • Push Ativo</div>
                </div>
            </div>
            <button type="button" data-zone-id="${esc(z.id)}" class="text-xs text-red-400 hover:text-red-300 px-2 py-1">
                <i class="fa-solid fa-trash"></i> Remover
            </button>
        </div>
    `).join('');
}

function render() {
    const persona = state.getPersona();
    document.getElementById('vaultUserName').textContent = persona.name;
    document.getElementById('vaultUserHash').textContent = persona.hash;
    renderMonitoredZones();
}

function exportUserDataJSON() {
    const persona = state.getPersona();
    const consents = state.getConsents();
    const exportPayload = {
        documento: "Relatório de Portabilidade de Dados Pessoais — Art. 18, V da LGPD (Lei 13.709/2018)",
        titular: persona.name,
        perfil: persona.role,
        identificador_anonimo_publico: persona.hash,
        criptografia_cofre: "AES-256 (arquitetura-alvo; não implementada no protótipo)",
        consentimentos_ativos: {
            geolocalizacao_truncada_100m: consents.geo,
            anonimizacao_relatos_publicos: consents.anon,
            notificacoes_emergencia: consents.push
        },
        zonas_monitoradas: state.getZones(),
        data_exportacao: new Date().toISOString()
    };
    document.getElementById('lgpdExportContent').textContent = JSON.stringify(exportPayload, null, 2);
    document.getElementById('lgpdExportBox').classList.remove('hidden');
    showToast('Pacote JSON de Portabilidade LGPD gerado com sucesso.', 'success');
}

// --- Modal do Direito ao Esquecimento (foco no diálogo, Escape fecha, foco volta ao botão) ---
const modal = () => document.getElementById('lgpdForgetModal');

function openLgpdForgetModal(e) {
    modalOpener = e.currentTarget;
    modal().classList.remove('hidden');
    document.getElementById('btnCancelForget').focus();
}

function closeLgpdForgetModal() {
    modal().classList.add('hidden');
    modalOpener?.focus();
}

export function init() {
    document.getElementById('zoneForm').addEventListener('submit', e => {
        e.preventDefault();
        const labelInput = document.getElementById('newZoneLabel');
        const label = labelInput.value.trim();
        if (!label) return;
        addMonitoredZone(label, document.getElementById('newZoneRegion').value);
        labelInput.value = '';
    });
    document.getElementById('monitoredZonesList').addEventListener('click', e => {
        const btn = e.target.closest('[data-zone-id]');
        if (btn) removeMonitoredZone(btn.dataset.zoneId);
    });
    document.getElementById('btnExportData').addEventListener('click', exportUserDataJSON);
    document.getElementById('btnCloseExport').addEventListener('click', () => {
        document.getElementById('lgpdExportBox').classList.add('hidden');
    });
    document.getElementById('btnOpenForget').addEventListener('click', openLgpdForgetModal);
    document.getElementById('btnCancelForget').addEventListener('click', closeLgpdForgetModal);
    document.getElementById('btnConfirmForget').addEventListener('click', () => {
        forgetPersonalData();
        closeLgpdForgetModal();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !modal().classList.contains('hidden')) closeLgpdForgetModal();
    });
    render();
    return { refresh: render };
}
