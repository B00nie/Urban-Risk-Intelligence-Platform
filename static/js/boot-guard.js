// Aviso de falha da inicialização, independente de main.js: script clássico, roda mesmo se nenhum módulo carregar.
// main.js chama bootGuard.finish() ao terminar, com sucesso ou com erro específico; a partir daí nada aqui age.
(() => {
    const LIMIT_MS = 15000; // acima dos 5 s de tempo limite da API, para não acusar erro em conexão apenas lenta
    const notice = document.getElementById('bootNotice');

    // Nenhum indicador continua sugerindo progresso depois de uma falha, e nenhum modo de dados é assumido.
    function stopIndicators() {
        const banner = document.getElementById('dataModeBanner');
        if (banner?.textContent.startsWith('Verificando')) banner.textContent = 'Modo de dados não determinado: a inicialização foi interrompida';
        document.querySelectorAll('#conteudo [role="status"]:has(.fa-spinner)').forEach(el => { el.textContent = 'Conteúdo não carregado; veja o aviso no início da tela.'; });
        document.querySelectorAll('#conteudo select option[value=""]').forEach(el => { if (el.textContent.startsWith('Carregando')) el.textContent = 'Não carregado'; });
    }

    function fail() {
        notice.classList.add('is-visible');
        notice.setAttribute('role', 'alert');
        document.getElementById('conteudo').prepend(notice); // main.js retira o aviso ao iniciar
        stopIndicators();
    }

    function onError(e) {
        const notFetched = e.target instanceof HTMLScriptElement && e.target.type === 'module'; // main.js ou import estático
        const threw = e instanceof ErrorEvent && e.filename?.includes('/static/js/'); // exceção ao avaliar um módulo
        if (notFetched || threw) fail();
    }

    const timer = setTimeout(fail, LIMIT_MS);
    window.addEventListener('error', onError, true); // captura: erro de carregamento de script não sobe até window

    window.bootGuard = {
        stopIndicators,
        finish() {
            clearTimeout(timer);
            window.removeEventListener('error', onError, true);
            notice.remove();
        }
    };
})();
