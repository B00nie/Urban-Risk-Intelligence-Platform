// Motor de regras determinístico (RN01 e RN02). Único lugar com as fórmulas do front-end.

// Limiar da RN01 a partir do qual um evento é confirmado e pode gerar comunicado.
export const NC_LIMIAR_CONFIRMACAO = 50;

/**
 * RN01: componentes do Nível de Confiança (usado no cálculo e na memória de cálculo da Tela 5).
 */
export function confidenceBreakdownRN01(evt) {
    const base = evt.baseWeight || 35;
    const mediaBonus = evt.hasExifMedia ? 15 : 0;
    const communityBonus = Math.min(45, (evt.communityConfirmations || 0) * 15);
    const floorApplied = Boolean(evt.sensorConvergence || evt.agentValidated);
    let total = base + mediaBonus + communityBonus;
    if (floorApplied) {
        total = Math.max(total, 95);
    }
    return { base, mediaBonus, communityBonus, floorApplied, nc: Math.min(100, total) };
}

/**
 * RN01: Calcula o Nível de Confiança (NC de 0% a 100%)
 */
export function calculateConfidenceRN01(evt) {
    return confidenceBreakdownRN01(evt).nc;
}

/**
 * RN02: Calcula o Score de Risco (0 a 100) e Faixa de Prioridade (P1 a P4)
 * Fórmula: Score = [(Severidade * 15) + (Impacto * 10)] * (NC / 100)
 */
export function calculateRiskScoreRN02(evt) {
    const nc = calculateConfidenceRN01(evt);
    const rawPoints = (evt.severity * 15) + (evt.impact * 10);
    const score = Math.round(rawPoints * (nc / 100));

    let band = 'BAIXO';
    let priorityCode = 'P4';
    let label = 'Risco Baixo (P4)';
    let colorHex = '#2563EB';
    let badgeClass = 'bg-blue-500/20 text-blue-300 border-blue-500/40';

    if (score >= 75) {
        band = 'CRITICO';
        priorityCode = 'P1';
        label = 'Risco Crítico (P1)';
        colorHex = '#DC2626';
        badgeClass = 'bg-red-500/20 text-red-300 border-red-500/40';
    } else if (score >= 50) {
        band = 'ALTO';
        priorityCode = 'P2';
        label = 'Risco Alto (P2)';
        colorHex = '#EA580C';
        badgeClass = 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    } else if (score >= 30) {
        band = 'MODERADO';
        priorityCode = 'P3';
        label = 'Risco Moderado (P3)';
        colorHex = '#D97706';
        badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }

    // Faixa de confiança da RN01 (só o nível; a origem do dado é exibida à parte, ver getSourceMeta).
    // O PDF chama a faixa >= 75% de "Fonte Oficial / Alta Confiança" (alinhamento registrado em PENDENCIAS.md).
    let sealLabel = 'Em Validação Preliminar';
    let sealClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    if (nc >= 75) {
        sealLabel = 'Alta Confiança';
        sealClass = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    } else if (nc >= 50) {
        sealLabel = 'Confirmado pela Comunidade';
        sealClass = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    }

    return {
        nc,
        rawPoints,
        score,
        band,
        priorityCode,
        label,
        colorHex,
        badgeClass,
        sealLabel,
        sealClass
    };
}
