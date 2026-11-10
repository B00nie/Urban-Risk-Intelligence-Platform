// Escape de HTML centralizado para templates que geram marcação.
// Use em TODO valor dinâmico (dados do usuário, da API, da URL ou do sessionStorage) inserido em
// texto ou em atributo entre aspas duplas. Não use em valores já escapados nem em marcação fixa.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ENTITIES[c]);
}
