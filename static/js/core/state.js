// Estado da demonstração e persistência entre páginas (sessionStorage: dura só enquanto a aba estiver aberta).
// A sessão de login fica em auth.js; aqui ficam só preferências e dados demonstrativos, nunca credenciais.
// O estado do usuário (consentimentos, zonas, notificações...) pertence à conta em ownerId e é
// descartado no logout ou na troca de conta; os eventos do modo local são compartilhados e ficam.
import { SEED_EVENTS, SEED_ZONES } from './data.js';
import { currentUser } from './auth.js';

const STORAGE_KEY = 'urbanRisk.sessao.v1';

const clone = value => JSON.parse(JSON.stringify(value));

function userDefaults() {
    return {
        ownerId: null,          // conta dona deste estado
        consents: { geo: false, anon: false, push: false }, // definidos no login; opcionais começam desmarcados
        zones: clone(SEED_ZONES),
        notifications: [],
        notifSeq: 0,
        notifSource: null,      // modo de dados para o qual as notificações iniciais foram geradas
        normalization: {},      // indicações "Já Normalizou" por evento (só nesta sessão do navegador)
        flash: null             // mensagem a exibir na próxima página
    };
}

function defaults() {
    return { ...userDefaults(), localEvents: null }; // localEvents: eventos do modo local (null = não carregados)
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

// --- Usuário conectado e consentimentos ---------------------------------------------------
// O perfil vem da sessão (servidor no Flask, conta fictícia no modo demonstrativo); não há troca aqui.
export const getPersona = () => currentUser();

// Estado de outra conta (sessão anterior que expirou sem logout) não passa para a conta atual.
export function bindUser(userId) {
    if (session.ownerId === userId) return;
    Object.assign(session, userDefaults(), { ownerId: userId });
    save();
}

// Logout: apaga só o estado do usuário; eventos compartilhados do modo local continuam.
export function clearUserState() {
    Object.assign(session, userDefaults());
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
