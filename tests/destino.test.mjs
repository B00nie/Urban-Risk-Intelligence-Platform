// Validação do destino pós-login (static/js/core/guard.js). Executar: node --test tests/destino.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = { querySelector: () => null }; // auth.js lê a marca do Flask ao carregar
const { safeDestination } = await import('../static/js/core/guard.js');

test('aceita páginas internas e ?evento=ID', () => {
    assert.equal(safeDestination('alertas.html'), 'alertas.html');
    assert.equal(safeDestination('detalhes.html?evento=EVT-2026-001'), 'detalhes.html?evento=EVT-2026-001');
    assert.equal(safeDestination('confianca.html?evento=EVT-2026-A1B2C3'), 'confianca.html?evento=EVT-2026-A1B2C3');
});

test('rejeita externos, protocol-relative e inesperados (vai para o painel)', () => {
    for (const raw of [
        null, '', 'https://atacante.example/', '//atacante.example', '/\\atacante.example', 'javascript:alert(1)',
        '../painel.html', '/painel.html', 'index.html', 'app.py', 'PAINEL.HTML', 'painel.html#x',
        'painel.html?outro=1', 'painel.html?evento=1&x=2', ' painel.html', 'painel.html\n'
    ]) {
        assert.equal(safeDestination(raw), 'painel.html', String(raw));
    }
});

test('evento com caracteres inesperados é descartado, a página fica', () => {
    assert.equal(safeDestination('detalhes.html?evento=%3Cscript%3E'), 'detalhes.html');
    assert.equal(safeDestination('detalhes.html?evento=%E0%A4%A'), 'detalhes.html');
});
