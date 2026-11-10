// Estado da demonstração e persistência entre páginas.
// Único módulo que acessa o sessionStorage: os dados duram só enquanto a aba estiver aberta.
// Guarda apenas o id da persona e dados demonstrativos; nunca credenciais, segredos ou dados pessoais reais.
import { PERSONAS, SEED_EVENTS, SEED_ZONES } from './data.js';

const STORAGE_KEY = 'urbanRisk.sessao.v1';

const clone = value => JSON.parse(JSON.stringify(value));

function defaults() {
    return {
        personaId: 'mariana',
        consents: { geo: true, anon: true, push: true },
        zones: clone(SEED_ZONES),
        notifications: [],
        notifSeq: 0,
        notifSource: null,      // modo de dados para o qual as notificações iniciais foram geradas
        normalization: {},      // indicações "Já Normalizou" por evento (só nesta sessão do navegador)
        localEvents: null,      // eventos do modo demonstrativo local (null = ainda não carregados)
        flash: null             // mensagem a exibir na próxima página
    };
}

function load() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
    } catch (err) {
        console.warn('Sessão da demonstração ilegível ou indisponível; usando valores iniciais.', err);
        return defaults();
    }
}

const session = load();
let events = [];
let dataSource = null; // 'api' | 'local'

function save() {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (err) {
        console.warn('Não foi possível salvar a sessão da demonstração.', err);
    }
}

// --- Mudanças de estado (avisa cabeçalho, barra lateral e a página ativa) ---------------
const bus = new EventTarget();
export function onChange(listener) {
    bus.addEventListener('change', listener);
}
export function emitChange() {
    bus.dispatchEvent(new Event('change'));
}

// --- Dados de eventos ----------------------------------------------------------------------
// Modo API: os eventos vêm do servidor a cada página (o SQLite é a fonte da verdade).
// Modo local: os eventos ficam na sessão do navegador; o conjunto inicial só é carregado uma vez.
export function initData(apiEvents) {
    if (apiEvents) {
        dataSource = 'api';
        events = apiEvents;
    } else {
        dataSource = 'local';
        if (!session.localEvents) {
            session.localEvents = clone(SEED_EVENTS);
            save();
        }
        events = session.localEvents;
    }
}

export const isApiMode = () => dataSource === 'api';
export const getEvents = () => events;
export const findEvent = id => events.find(e => e.id === id);

export function addEvent(evt) {
    events.unshift(evt);
    saveEvents();
}

// Grava as alterações dos eventos na sessão (só no modo local; no modo API quem grava é a API).
export function saveEvents() {
    if (dataSource === 'local') {
        session.localEvents = events;
        save();
    }
}

// --- Persona e consentimentos ------------------------------------------------------------
export const getPersona = () => PERSONAS[session.personaId] || PERSONAS.mariana;

export function setPersona(personaId) {
    session.personaId = PERSONAS[personaId] ? personaId : 'mariana';
    save();
}

export const getConsents = () => ({ ...session.consents });

export function setConsent(key, value) {
    session.consents[key] = Boolean(value);
    save();
}

// --- Zonas monitoradas --------------------------------------------------------------------
export const getZones = () => session.zones;

export function setZones(zones) {
    session.zones = zones;
    save();
}

// --- Notificações -------------------------------------------------------------------------
export const getNotifications = () => session.notifications;
export const needsNotificationSeed = () => session.notifSource !== dataSource;

export function setSeedNotifications(list) {
    session.notifications = list;
    session.notifSource = dataSource;
    save();
}

export function nextNotificationId() {
    session.notifSeq += 1;
    save();
    return `NOTIF-${session.notifSeq}`;
}

export function addNotification(notification) {
    session.notifications.unshift(notification);
    save();
}

export function markNotificationsRead(predicate) {
    session.notifications.forEach(n => {
        if (predicate(n)) n.unread = false;
    });
    save();
}

// --- Indicações "Já Normalizou" -----------------------------------------------------------
export const getNormalizationCount = eventId => session.normalization[eventId] || 0;

export function addNormalization(eventId) {
    session.normalization[eventId] = getNormalizationCount(eventId) + 1;
    save();
    return session.normalization[eventId];
}

// --- Mensagem para a próxima página -------------------------------------------------------
export function setFlash(message, type = 'info') {
    session.flash = { message, type };
    save();
}

export function takeFlash() {
    const flash = session.flash;
    if (flash) {
        session.flash = null;
        save();
    }
    return flash;
}
