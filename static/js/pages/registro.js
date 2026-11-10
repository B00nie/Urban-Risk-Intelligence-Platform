// Tela 6 (registro.html): registro comunitário com prévia ao vivo de RN01, RN02 e RN03 (RF07, RNF04).
import * as state from '../core/state.js';
import { calculateRiskScoreRN02, NC_LIMIAR_CONFIRMACAO } from '../core/rules.js';
import { createCommunityReport } from '../core/actions.js';
import { eventUrl } from '../components/eventPicker.js';

function readForm() {
    const catEl = document.querySelector('input[name="reportCategory"]:checked');
    const [neighborhood, latStr, lngStr] = document.getElementById('reportLocation').value.split('|');
    return {
        category: catEl ? catEl.value : 'ALAGAMENTO',
        neighborhood,
        lat: parseFloat(latStr),
        lng: parseFloat(lngStr),
        severity: parseInt(document.getElementById('reportSeverity').value || '3', 10),
        impact: parseInt(document.getElementById('reportImpact').value || '3', 10),
        title: document.getElementById('reportTitle').value.trim(),
        description: document.getElementById('reportDescription').value.trim(),
        hasPhoto: document.getElementById('reportHasPhoto').checked,
        hasSensor: document.getElementById('reportHasSensorMatch').checked
    };
}

function updateReportPreview() {
    const persona = state.getPersona();
    const form = readForm();

    const tempEvt = {
        baseWeight: 35,
        hasExifMedia: form.hasPhoto,
        communityConfirmations: 0,
        sensorConvergence: form.hasSensor,
        agentValidated: persona.isAgent,
        severity: form.severity,
        impact: form.impact
    };

    const calc = calculateRiskScoreRN02(tempEvt);

    document.getElementById('previewConfidenceBadge').textContent = `${calc.nc}% • ${calc.sealLabel}`;
    document.getElementById('previewConfidenceBar').style.width = `${calc.nc}%`;
    document.getElementById('previewRiskScore').textContent = `${calc.score} pts • ${calc.label}`;
    document.getElementById('previewRiskScore').className = `px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${calc.badgeClass}`;

    const initialState = calc.nc >= NC_LIMIAR_CONFIRMACAO ? 'Confirmado ➔ Alerta Emitido' : 'Retido em "Em Validação" (NC < 50%)';
    document.getElementById('previewInitialState').textContent = initialState;

    // RN03 Data Sanitizer JSON Preview
    const sanitizedPayload = {
        origem: "REGISTRO_COMUNITARIO_LGPD",
        autor_publico: persona.hash,
        dados_pessoais_removidos: ["nome_civil", "cpf", "telefone"],
        categoria: form.category,
        bairro: form.neighborhood,
        coordenadas_truncadas_100m: [form.lat.toFixed(3), form.lng.toFixed(3)],
        severidade_S: form.severity,
        impacto_I: form.impact,
        midia_exif_valida: form.hasPhoto,
        confianca_calculada_RN01: `${calc.nc}%`,
        score_risco_RN02: calc.score
    };
    document.getElementById('previewSanitizedJson').textContent = JSON.stringify(sanitizedPayload, null, 2);
}

async function submitCommunityReport(e) {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true; // evita relato duplicado enquanto a API grava
    submitButton.querySelector('span').textContent = 'Enviando relato…';
    const { evt, calc, synced } = await createCommunityReport(readForm());
    if (synced) {
        state.setFlash(`Relato ${evt.id} anonimizado e processado. Estado: ${evt.state} (Confiança ${calc.nc}%, ${calc.label}).`, 'success');
    } else {
        state.setFlash(`Relato ${evt.id} não foi gravado pela API local (SQLite); ele não aparece após recarregar a página.`, 'warning');
    }
    window.location.href = eventUrl('detalhes.html', evt.id);
}

export function init() {
    const form = document.getElementById('communityReportForm');
    form.addEventListener('change', updateReportPreview);
    form.addEventListener('submit', submitCommunityReport);
    updateReportPreview();
    return { refresh: updateReportPreview };
}
