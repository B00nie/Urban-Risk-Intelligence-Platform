// Dados demonstrativos do protótipo (copiados sem alteração da versão de página única).
// São apenas dados de exemplo: nenhuma pessoa real, credencial ou segredo.

// Personas: agora são as contas de acesso (static/js/core/auth.js e app.py).

// Initial Seed Events (100% Aligned with RN01 & RN02 Examples from the Doc)
export const SEED_EVENTS = [
    {
        id: 'EVT-2026-001',
        title: 'Transbordamento de Córrego e Alagamento Severo',
        category: 'ALAGAMENTO',
        neighborhood: 'Vila Mariana (Zona Sul)',
        lat: -23.5891,
        lng: -46.6346,
        severity: 4, // S = 4 (Extremo > 50cm)
        impact: 4,   // I = 4 (Próximo a metrô e hospital)
        sourceType: 'PUBLIC_API',
        sourceName: 'Sensor Nível IoT #HIDRO-VM-09 + Defesa Civil SP',
        baseWeight: 85,
        hasExifMedia: true,
        communityConfirmations: 4,
        sensorConvergence: true,
        agentValidated: true,
        state: 'Alerta Emitido',
        timestamp: 'Há 6 min',
        slaEstimate: 'Equipes da Defesa Civil no local • Desvio pela Av. Domingos de Morais',
        description: 'Extravasamento detectado por régua telemétrica no Córrego da Vila Mariana com lâmina de água superior a 55cm. Via bloqueada nos dois sentidos próximo à estação.',
        recommendations: [
            'Evite trafegar pela baixada da Vila Mariana e utilize a linha azul do Metrô apenas pelo acesso alto.',
            'Jamais tente atravessar enxurradas a pé ou de veículo.',
            'Acione 199 (Defesa Civil) em caso de entrada de água em imóveis.'
        ]
    },
    {
        id: 'EVT-2026-002',
        title: 'Alagamento Intransitável na Faixa de Ônibus',
        category: 'ALAGAMENTO',
        neighborhood: 'Av. Paulista / Bela Vista',
        lat: -23.5641,
        lng: -46.6524,
        severity: 3, // S = 3
        impact: 3,   // I = 3
        sourceType: 'IOT_SENSOR',
        sourceName: 'Pluviômetro Urbano IoT #PLUV-PAU-042 + 2 Moradores',
        baseWeight: 80,
        hasExifMedia: true,
        communityConfirmations: 2,
        sensorConvergence: true,
        agentValidated: false,
        state: 'Em Monitoramento',
        timestamp: 'Há 14 min',
        slaEstimate: 'Equipes de drenagem acionadas • Previsão de escoamento em 45 min',
        description: 'Acúmulo rápido de água (38cm) bloqueando a faixa exclusiva de ônibus e travessia de pedestres.',
        recommendations: [
            'Utilize o acesso subterrâneo do Metrô Trianon-Masp/Brigadeiro.',
            'Linhas de ônibus operando com desvio pela Alameda Santos.'
        ]
    },
    {
        id: 'EVT-2026-003',
        title: 'Queda de Energia em Setor Residencial e Semáforos',
        category: 'ENERGIA',
        neighborhood: 'Pinheiros (Zona Oeste)',
        lat: -23.5672,
        lng: -46.6938,
        severity: 3, // S = 3
        impact: 3,   // I = 3
        sourceType: 'COMMUNITY',
        sourceName: 'Cluster de 5 Relatos Comunitários (#A8F92B e vizinhos)',
        baseWeight: 35,
        hasExifMedia: true,
        communityConfirmations: 2,
        sensorConvergence: false,
        agentValidated: false,
        state: 'Alerta Emitido',
        timestamp: 'Há 19 min',
        slaEstimate: 'CCO Concessionária acionado • Restabelecimento estimado até 19h30',
        description: 'Desarme de transformador deixando quarteirões sem energia elétrica e semáforos apagados no cruzamento principal.',
        recommendations: [
            'Redobre a atenção em cruzamentos com semáforos inoperantes.',
            'Mantenha aparelhos sensíveis desconectados da tomada até a estabilização.'
        ]
    },
    {
        id: 'EVT-2026-004',
        title: 'Ilha de Calor Severa (+5.4°C Acima da Média e Umidade 18%)',
        category: 'CALOR',
        neighborhood: 'Centro Histórico (Sé / Anhangabaú)',
        lat: -23.5489,
        lng: -46.6388,
        severity: 3, // S = 3
        impact: 2,   // I = 2
        sourceType: 'PUBLIC_API',
        sourceName: 'API Oficial INMET / CGE Estação Sé #MET-01',
        baseWeight: 85,
        hasExifMedia: false,
        communityConfirmations: 1,
        sensorConvergence: false,
        agentValidated: true,
        state: 'Em Monitoramento',
        timestamp: 'Há 28 min',
        slaEstimate: 'Alerta ativo até 18h00 • Tendas de hidratação abertas na Praça da Sé',
        description: ' Superfície asfáltica com retenção térmica severa (38.7°C à sombra) e umidade relativa do ar em nível de emergência (18%).',
        recommendations: [
            'Hidrate-se constantemente e evite exposição direta ao sol entre 11h e 16h.',
            'Procure pontos de resfriamento e hidratação municipais.'
        ]
    },
    {
        id: 'EVT-2026-005',
        title: 'Paralisação Parcial na Linha de Ônibus e Terminal Urbano',
        category: 'TRANSPORTE',
        neighborhood: 'Itaquera (Zona Leste)',
        lat: -23.5415,
        lng: -46.4710,
        severity: 2, // S = 2
        impact: 3,   // I = 3
        sourceType: 'PUBLIC_API',
        sourceName: 'API Pública SPTrans OlhoVivo + Relato #C91D04',
        baseWeight: 85,
        hasExifMedia: false,
        communityConfirmations: 1,
        sensorConvergence: false,
        agentValidated: false,
        state: 'Confirmado',
        timestamp: 'Há 35 min',
        slaEstimate: 'Operação assistida • Frota de apoio PAESE em deslocamento',
        description: 'Atraso severo na saída de coletivos do terminal devido a interferência viária na Radial Leste.',
        recommendations: [
            'Prefira o embarque pela Linha 3-Vermelha do Metrô ou CPTM.',
            'Acompanhe a liberação da via pelo painel.'
        ]
    },
    {
        id: 'EVT-2026-006',
        title: 'Relato Preliminar de Baixa Pressão / Falta de Água',
        category: 'AGUA',
        neighborhood: 'Mooca / Tamanduateí (Zona Leste)',
        lat: -23.5610,
        lng: -46.5975,
        severity: 2, // S = 2
        impact: 1,   // I = 1
        sourceType: 'COMMUNITY',
        sourceName: 'Relato Comunitário Isolado (Morador Verificado #F42E11)',
        baseWeight: 35,
        hasExifMedia: false,
        communityConfirmations: 0,
        sensorConvergence: false,
        agentValidated: false,
        state: 'Em Validação',
        timestamp: 'Há 9 min',
        slaEstimate: 'Aguardando confirmação cruzada (RN01: NC < 50%)',
        description: 'Morador reportou interrupção no abastecimento de água em rua residencial. Evento aguarda confirmação de vizinhos num raio de 500m ou telemetria da Sabesp.',
        recommendations: [
            'Se você está próximo, utilize o botão "Eu Também Vejo" na Tela 4 para validar o alerta.',
            'Economize água da caixa reservatória preventiva.'
        ]
    }
];

// Monitored Zones State (Tela 8)
export const SEED_ZONES = [
    { id: 'Z1', label: 'Casa (Residência)', region: 'Vila Mariana (Raio 1km)', active: true },
    { id: 'Z2', label: 'Trabalho (Escritório)', region: 'Centro / Sé (Raio 1km)', active: true },
    { id: 'Z3', label: 'Faculdade (FIAP)', region: 'Av. Paulista (Raio 500m)', active: true }
];

// Estados em que um evento é tratado como alerta ativo (notificações e push simulado).
export const ACTIVE_ALERT_STATES = ['Confirmado', 'Alerta Emitido', 'Em Monitoramento'];

// Ações de moderação (RF11) válidas em cada estado, conforme o Diagrama de Estados.
// Espelhada em app.py (TRANSICOES_CICLO_DE_VIDA), que valida o PATCH.
// "Alerta Emitido" -> "Alerta Emitido" é a validação oficial de um alerta já emitido (piso de 95%, RN01).
export const STATE_TRANSITIONS = {
    'Em Validação': ['Alerta Emitido', 'Descartado'],
    'Confirmado': ['Alerta Emitido'],
    'Alerta Emitido': ['Alerta Emitido', 'Em Monitoramento'],
    'Em Monitoramento': ['Alerta Emitido', 'Encerrado', 'Descartado'],
    'Encerrado': [],
    'Descartado': []
};

export const allowedTransitions = stateName => STATE_TRANSITIONS[stateName] || [];
export const isFinalState = stateName => stateName === 'Encerrado' || stateName === 'Descartado';

// Origem do dado (RF06), exibida separada da faixa de confiança da RN01.
const SOURCE_META = {
    PUBLIC_API: { label: 'Base pública oficial', icon: 'fa-building-columns' },
    IOT_SENSOR: { label: 'Sensor IoT', icon: 'fa-tower-broadcast' },
    COMMUNITY: { label: 'Relato comunitário', icon: 'fa-users' }
};

export function getSourceMeta(sourceType) {
    return SOURCE_META[sourceType] || { label: 'Origem não informada', icon: 'fa-circle-question' };
}

export function getCategoryMeta(cat) {
    const map = {
        ALAGAMENTO: { name: 'Alagamento / Enxurrada', icon: 'fa-house-flood-water', color: 'text-blue-400' },
        CALOR: { name: 'Ilha de Calor Extremo', icon: 'fa-temperature-arrow-up', color: 'text-orange-400' },
        ENERGIA: { name: 'Interrupção de Energia', icon: 'fa-plug-circle-xmark', color: 'text-amber-400' },
        AGUA: { name: 'Desabastecimento de Água', icon: 'fa-faucet-drip', color: 'text-cyan-400' },
        TRANSPORTE: { name: 'Paralisação de Transporte', icon: 'fa-train-subway', color: 'text-purple-400' }
    };
    return map[cat] || map.ALAGAMENTO;
}
