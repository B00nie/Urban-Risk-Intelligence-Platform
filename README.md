# Urban Risk Intelligence Platform — CitizenTech (Global Solution 2026.2)

Plataforma integrada de monitoramento, validação cruzada e priorização de alertas para riscos urbanos cotidianos (**alagamentos, ilhas de calor e interrupções de serviços essenciais de energia, água e transporte**), desenvolvida para a disciplina de **Engenharia de Software** (Engenharia da Computação — FIAP).

---

## Integrantes do Grupo
| Nome Completo | RM |
| :--- | :--- |
| **Bruno Seidi Ferreira Takaya** | 554986 |
| **Iury Cardoso Araujo** | 558850 |
| **Jhonatan Lopes Da Silva** | 559174 |

---

## Arquitetura e Tecnologias Utilizadas
* **Front-end (8 páginas HTML + `static/`):** HTML5, Tailwind CSS 3.4.17 (arquivo CSS gerado, em `static/css/tailwind.css`), JavaScript com **módulos ES nativos** e **Leaflet.js** (mapa georreferenciado de São Paulo com raios de impacto de 500m). Sem framework nem bundler; o site publicado não executa Node. Cada tela é uma página própria, com navegação por barra lateral — decisão de arquitetura e apresentação do grupo, não exigência do enunciado.
  * **Mapa base:** tiles padrão do **OpenStreetMap** (`tile.openstreetmap.org`, HTTPS, com atribuição visível). Uso interativo comum, sem prefetch nem download em massa, conforme a [política de tiles da OSMF](https://operations.osmfoundation.org/policies/tiles/).
* **Back-end (`app.py`):** **Python 3 + Flask** servindo API REST e motor de regras determinístico (`RN01`, `RN02` e `RN03`).
* **Banco de Dados (`urban_risk_platform.db`):** **SQLite3** com tabelas separadas para ocorrências georreferenciadas (`risk_events`) e dados pessoais (`users_lgpd_vault`), projetado para atender à **LGPD (Lei nº 13.709/2018)**. Criptografia AES-256, TLS 1.3, Redis, MQTT e WebSockets pertencem à **arquitetura-alvo** descrita no documento do projeto e não estão implementados neste protótipo acadêmico.

---

## Mapeamento das 8 Telas Obrigatórias no Protótipo
1. **Tela 1 — Login e Consentimento LGPD (`RF01`, `RNF05`, `RN03`):** Login por usuário ou e-mail e senha nas contas das 3 Personas (*Mariana Costa — Moradora*, *Cap. Roberto Mendes — Defesa Civil* e *Eng. Lucas Oliveira — Operador CCO*), com ciência obrigatória do aviso de privacidade da demonstração e escolhas opcionais e separadas de geolocalização truncada e notificações (recusá-las não impede a entrada; nenhuma localização é pedida ao navegador). O perfil pertence à conta. Veja [Acesso e autenticação](#acesso-e-autenticação).
2. **Tela 2 — Painel de Acompanhamento e Mapa Interativo (`RF02`, `RF03`, `RF12`, `RNF01`):** Mapa com marcadores por nível de risco, círculos de 500m, indicadores calculados a partir dos eventos carregados, ocorrências ativas por categoria, meta de atualização ($\le 5\text{s}$, não medida) e simulador de leitura de sensor IoT.
3. **Tela 3 — Lista de Alertas Priorizados (`RF04`, `RN02`):** Listagem ordenada automaticamente pelo **Score de Risco** (`Crítico P1` $\rightarrow$ `Alto P2` $\rightarrow$ `Moderado P3` $\rightarrow$ `Baixo P4`) com filtros por categoria, bairro, nível de risco, estado e confiança.
4. **Tela 4 — Detalhes do Alerta, Ciclo de Vida UML e Moderação (`RF05`, `RF08`, `RF11`):** Linha do tempo interativa refletindo o **Diagrama de Estados UML** (*Reportado* $\rightarrow$ *Em Validação* $\rightarrow$ *Confirmado* $\rightarrow$ *Alerta Emitido* $\rightarrow$ *Em Monitoramento* $\rightarrow$ *Encerrado / Descartado*), botões de validação cruzada para moradores (`+15%` de confiança) e painel de moderação para agentes.
5. **Tela 5 — Origem e Nível de Confiança do Dado (`RF06`, `RN01`, `RN02`):** Auditoria transparente da fonte geradora do dado (ID do sensor IoT, API oficial ou hash comunitário) e tabela matemática passo a passo do cálculo de confiança e risco.
6. **Tela 6 — Registro Comunitário de Ocorrência (`RF07`, `RNF04`, `RN03`):** Formulário em 3 cliques com prévia ao vivo da anonimização LGPD (`Data Sanitizer`) e cálculo instantâneo de confiança e risco.
7. **Tela 7 — Central de Notificações (`RF09`, `RNF01`, `RNF03`):** Caixa de avisos segmentada pelas zonas monitoradas do usuário. Prioridade, score e confiança de cada aviso são derivados do evento pelas regras RN01/RN02; cada aviso leva ao mapa, aos detalhes e à origem; o push é simulado no navegador.
8. **Tela 8 — Perfil, Zonas Monitoradas e Cofre LGPD (`RF10`, `RNF05`):** Cadastro de zonas de interesse (*Casa, Trabalho, FIAP*), exportação de dados em JSON (*Portabilidade*) e demonstração do *Direito ao Esquecimento*. Tudo isso vale só para a sessão do navegador.

---

## Arquivos do Projeto

| Arquivo | Papel |
| :--- | :--- |
| `index.html` | **Oficial** — Tela 1: login e consentimento LGPD (única página acessível sem sessão) |
| `painel.html` | **Oficial** — Tela 2: visão geral, indicadores e mapa (única página que carrega o Leaflet) |
| `alertas.html` | **Oficial** — Tela 3: lista priorizada pelo Score de Risco (RN02) |
| `detalhes.html` | **Oficial** — Tela 4: detalhes, ciclo de vida e moderação (`?evento=ID`) |
| `confianca.html` | **Oficial** — Tela 5: origem do dado e memória de cálculo RN01/RN02 (`?evento=ID`) |
| `registro.html` | **Oficial** — Tela 6: registro comunitário |
| `notificacoes.html` | **Oficial** — Tela 7: central de notificações |
| `perfil.html` | **Oficial** — Tela 8: perfil, zonas monitoradas e privacidade |
| `static/css/tailwind.css` | **Gerado** por `npm run build:css`. Necessário à publicação; não edite à mão |
| `static/css/styles.css` | Estilos comuns (layout com barra lateral, scrollbar, animação) |
| `static/css/painel.css` | Estilos só do mapa (tiles, popups, pulso P1) |
| `static/js/boot-guard.js` | Aviso de falha se `main.js` não carregar ou não terminar (script clássico, independente dos módulos) |
| `static/js/main.js` | Ponto de entrada: no login, só a tela de login; nas páginas internas, verifica a sessão antes de carregar estado, cabeçalho, barra lateral, dados e o módulo da página |
| `static/js/core/` | `auth.js` (sessão nos dois modos: login, sessão atual, logout, CSRF), `guard.js` (bloqueio das páginas internas e destino seguro após o login), `rules.js` (RN01/RN02), `data.js` (dados demonstrativos), `api.js` (API Flask), `state.js` (estado do usuário e `sessionStorage`), `actions.js` (relato, confirmação, moderação, notificações, zonas), `escape.js` (escape de HTML centralizado) |
| `static/js/components/` | `header.js`, `sidebar.js`, `toast.js`, `eventPicker.js` (evento na URL, seletor e estado vazio) |
| `static/js/pages/` | Lógica de cada uma das 8 páginas |
| `app.py` | **Oficial** — API Flask + SQLite (opcional para navegar no protótipo). Serve apenas as 8 páginas (lista fechada), marcadas para o modo API, e a pasta `static/`; autentica, controla sessões e verifica perfil nas páginas e na API |
| `tests/` | `test_auth.py` (autenticação, autorização e regras no Flask, com banco temporário) e `destino.test.mjs` (validação do destino pós-login) |
| `requirements.txt` | Dependências Python |
| `package.json`, `package-lock.json`, `tailwind.config.js`, `tailwind.input.css` | Só para regenerar o CSS no desenvolvimento (Tailwind 3.4.17 fixado). Não fazem parte do site publicado |
| `.gitignore` | Arquivos locais que não entram no repositório |
| `urban_risk_platform.db` | Banco local gerado na primeira execução — não versionado (`.gitignore`) |

---

## Como Executar o Projeto Localmente

> **Abra sempre por HTTP** — pelo Flask (Opção 1), por um servidor local ou pelo link público (Opção 2). Abrir os arquivos `.html` diretamente (`file://`) **não funciona**: o navegador bloqueia os módulos JavaScript nessa origem, e a página mostra um aviso.

### Como o modo é escolhido
* **Modo API:** só quando as páginas são abertas pelo próprio Flask (`python app.py`, em `http://localhost:5000`). O `app.py` marca cada página entregue, e o front-end consulta a API no mesmo endereço.
* **Modo demonstrativo:** em qualquer hospedagem estática, inclusive o link público e um servidor HTTP local. Sem a marca, o front-end não faz nenhuma requisição à API e não grava em banco, mesmo que o Flask esteja aberto no mesmo computador.

### Opção 1: Front-end + API Python/SQLite
1. Tenha o **Python 3.9+** instalado (testado com Python 3.13 e Flask 3.1).
2. Na pasta do projeto, instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```
3. Inicie o servidor:
   ```bash
   python app.py
   ```
4. Abra no navegador:
   ```text
   http://localhost:5000
   ```
   Sem conta configurada, ninguém entra: antes, rode `python app.py preparar-contas-demo` (veja [Contas no Flask](#contas-no-flask)). Depois do login, o cabeçalho deve mostrar **"API Flask/SQLite conectada — dados de demonstração"**. A API de eventos fica em `http://localhost:5000/api/events`. As demais telas ficam em `http://localhost:5000/painel.html`, `/alertas.html` etc.; qualquer outro arquivo da pasta (como `app.py` ou o banco) responde 404.

   *O servidor aceita conexões apenas desta máquina (`127.0.0.1`, porta 5000) e roda com depuração desligada. É uma execução local de desenvolvimento, não uma configuração de produção.*

   *O arquivo `urban_risk_platform.db` é criado ao lado de `app.py` na primeira execução. As execuções seguintes reaproveitam o banco existente, sem apagar dados nem duplicar os registros iniciais; as tabelas de contas e sessões são acrescentadas a um banco já existente sem alterar as outras. Para voltar ao estado inicial, pare o servidor e remova manualmente esse arquivo. Para usar outro arquivo (ex.: testes), defina `URBAN_RISK_DB_PATH`.*

#### Depuração local (opcional, apenas durante o desenvolvimento)
Para ligar o modo de depuração do Flask de forma explícita, defina a variável `URBAN_RISK_DEBUG=1` antes de iniciar:
```bash
# PowerShell
$env:URBAN_RISK_DEBUG = "1"; python app.py
# Git Bash / Linux / macOS
URBAN_RISK_DEBUG=1 python app.py
```
Desligue ao terminar (feche o terminal ou remova a variável). Não use depuração fora do desenvolvimento local.

### Opção 2: Somente o Front-end (link público / navegador)
* **O link público usa este modo** (modo demonstrativo). Uma hospedagem estática, como o GitHub Pages, serve só arquivos: o Flask e o banco não fazem parte dela.
* Abra `index.html` pelo link público ou por um servidor HTTP local. O cabeçalho mostra **"Modo demonstrativo local — dados em JavaScript (sessão do navegador)"**: os eventos vêm de `static/js/core/data.js`, e as alterações ficam só na sessão do navegador. As 8 telas e os cálculos de confiança (RN01) e risco (RN02) funcionam do mesmo jeito.
* Publique ou copie sempre **as 8 páginas `.html` junto com a pasta `static/`**, incluindo `static/css/tailwind.css`. Os caminhos são relativos, então o site funciona também em subdiretório (ex.: GitHub Pages em `/<repositorio>/`).
* Para testar localmente por HTTP sem a API, copie **apenas** os 8 arquivos `.html` e a pasta `static/` para uma pasta separada e sirva essa pasta (ex.: `python -m http.server 8000 --bind 127.0.0.1`). Não sirva a pasta do projeto inteira, que contém `app.py` e o banco.
* **É preciso HTTP:** abrir os arquivos por `file://` não funciona, porque o navegador bloqueia módulos ES nessa origem (cada página mostra um aviso quando isso acontece).
* Os dois modos usam conjuntos de exemplo diferentes: a API inicia com 3 eventos, e o modo demonstrativo local com 6. As notificações iniciais são geradas a partir do conjunto carregado, então sempre apontam para eventos existentes.
* **Pelo Flask, se a lista de eventos não responder** depois do login, o cabeçalho sai de "Verificando API local…" em até 5 s e mostra os eventos demonstrativos locais. A sessão, porém, nunca vira demonstrativa: se o login ou a verificação da sessão no Flask falhar, a tela mostra o erro e nenhuma página interna abre.
* **Se a tela não carregar**, a faixa vermelha diz o que houve: arquivo JavaScript que não chegou ao navegador (servidor parado ou resposta interrompida; confira o servidor e recarregue) ou erro de JavaScript (detalhes no console). Se o próprio `main.js` falhar, um aviso em amarelo orienta recarregar e verificar a conexão: na hora, quando o navegador informa a falha, ou depois de 15 s sem a tela terminar de carregar. Uma conexão lenta que termina antes disso não mostra aviso; se terminar depois, o aviso some sozinho.

### Repositório × site publicado
* **Repositório público:** todo arquivo versionado fica visível no GitHub, inclusive `app.py` e os arquivos de geração do CSS. O `.gitignore` deixa de fora o banco local, `node_modules/`, configurações locais e materiais de trabalho que ficam só na máquina do autor. Ele não remove arquivos que já tenham sido rastreados.
* **Site no GitHub Pages:** o navegador usa só as 8 páginas `.html` e a pasta `static/`. Se o Pages publicar a raiz do repositório, os demais arquivos versionados também ficam acessíveis pela URL do site, mas não são carregados pelo protótipo. Para publicar só o necessário, use uma branch ou pasta que contenha apenas as 8 páginas e `static/`.
* O Flask e o banco não rodam no GitHub Pages: o link público funciona sempre no modo demonstrativo.

### Compatibilidade
* Verificado no Chrome para computador: em janela, de 768 a 1920 px de largura; com largura simulada, a partir de 360 px; zoom de 200% conferido em três telas.
* Não verificado: celular físico, Firefox, Safari, leitor de tela e auditoria de contraste. Ausência de rolagem horizontal não comprova conformidade com a WCAG.

### CSS do Tailwind
`static/css/tailwind.css` já vem pronto: executar ou publicar o site não exige Node. Regenere só se alterar classes em HTML ou JS, ou o tema (requer Node.js):
```bash
npm install
npm run build:css
```
* A geração varre `*.html` e `static/js/**/*.js`. Escreva classes como strings inteiras: nomes montados por concatenação, como `` `bg-${cor}-500` ``, não entram no CSS.
* Nas páginas, `tailwind.css` vem por último no `<head>`, depois do Leaflet e do CSS autoral. Mudar essa ordem altera a cascata e a aparência.
* **O site precisa de internet:** Google Fonts, Font Awesome, Leaflet e os tiles do OpenStreetMap vêm de servidores externos. Só o CSS do Tailwind é local.

### Navegação e dados entre páginas
* A barra lateral liga as 8 páginas por links reais e marca a página atual (`aria-current="page"`). A partir de 1280 px ela fica fixa ao lado do conteúdo; em telas menores (celular, tablet e notebooks pequenos) abre pelo botão de menu do cabeçalho e fecha com o botão ×, tocando fora ou com `Esc`.
* Detalhes e Origem/Confiança recebem a ocorrência pela URL (ex.: `detalhes.html?evento=EVT-2026-001`); abrir o link diretamente ou atualizar a página mantém o evento. Sem evento, a página mostra um estado vazio com seletor.
* Consentimentos, zonas, notificações e indicações "Já Normalizou" ficam no `sessionStorage` do navegador (apagado ao fechar a aba), ligados à conta que entrou; são descartados no logout ou se outra conta entrar na mesma aba. No modo local, os eventos também ficam ali; no modo API, os eventos sempre vêm do SQLite e as alterações (relato, sensor, confirmação, mudança de estado) são gravadas pela API. Zonas, consentimentos, notificações e "Já Normalizou" **não** são gravados no SQLite.
* **Ver no mapa:** cada notificação abre `painel.html?evento=ID`, que centraliza o mapa, abre o popup e destaca o evento na fila. O painel avisa se o evento não existir, estiver em estado final, estiver oculto pelo filtro ou se o mapa não carregar. Abrir por aí marca a notificação como lida, como os outros links dela.
* **Ocorrências ativas por categoria:** contam qualquer estado, exceto Encerrado e Descartado, no conjunto carregado no modo atual. Não mudam com o filtro do mapa, e "Eventos por Origem" continua sendo outro indicador.
* Use apenas dados fictícios nos formulários: o que é digitado fica na sessão do navegador.

### Confiança, origem e conteúdo exibido
* A faixa de confiança da RN01 ("Alta Confiança", "Confirmado pela Comunidade", "Em Validação Preliminar") e a **origem do dado** (base pública oficial, sensor IoT ou relato comunitário) aparecem em selos separados; o percentual é o mesmo calculado pela RN01.
* A prioridade (P1–P4) aparece em texto nos selos e nos marcadores do mapa, além da cor.
* Textos vindos do usuário, da API, da URL ou da sessão são exibidos como texto (escape centralizado em `static/js/core/escape.js`). Isso foi testado com entradas contendo HTML e scripts; não substitui validação no servidor, que a API ainda não faz.

## Acesso e autenticação

Os dois modos são escolhidos pela mesma regra de sempre (marca injetada pelo `app.py`) e têm garantias diferentes.

### Contas de demonstração para avaliação
| Usuário | E-mail fictício | Perfil | Senha |
| :--- | :--- | :--- | :--- |
| `mariana` | `mariana@demo.example` | Moradora (visualização, relato e confirmação cruzada) | `1234` |
| `roberto` | `roberto@demo.example` | Agente Local — Defesa Civil (+ moderação, RF11) | `1234` |
| `lucas` | `lucas@demo.example` | Operador CCO — Concessionária (+ moderação, RF11) | `1234` |

São credenciais **públicas**, criadas só para a avaliação acadêmica com dados fictícios. Não são senhas pessoais nem recomendação de senha para uso real. No modo estático valem sempre; no Flask, só depois da preparação explícita descrita em [Contas no Flask](#contas-no-flask).

### Acesso demonstrativo (hospedagem estática / link público)
* As três contas de avaliação (tabela abaixo) aparecem na seção "Contas de demonstração para avaliação" da tela de login. O formulário não é preenchido nem enviado automaticamente.
* A sessão demonstrativa fica no `sessionStorage` (`urbanRisk.auth.v1` = id da conta e expiração em 2 h). A senha digitada não é guardada.
* Sem sessão, as páginas internas voltam ao login, preservando o destino. O perfil vem da conta; não há troca de perfil depois de entrar.
* **Não é autenticação segura.** Não há servidor: qualquer pessoa pode editar o storage ou o JavaScript no navegador e passar pelo bloqueio. Ele só organiza a demonstração. Nenhuma API é consultada neste modo.

### Autenticação real no Flask local
* `POST /api/auth/login`, `GET /api/auth/session` e `POST /api/auth/logout`. Senhas guardadas só como hash scrypt (`werkzeug.security`, já instalado com o Flask; nenhuma dependência nova).
* Sessão no servidor (tabela `auth_sessions`): o cookie `urban_risk_sid` leva um token aleatório, e o banco guarda só o SHA-256 dele. Expira em 2 h, é revogada no logout e em toda troca de senha da conta; um cookie revogado ou expirado é recusado mesmo se reenviado. Novo login troca o token.
* Cookie `HttpOnly` e `SameSite=Lax`; `Secure` quando a requisição chega por HTTPS ou com `URBAN_RISK_COOKIE_SECURE=1` (implantação atrás de proxy HTTPS).
* CSRF: toda operação que altera dados exige o cabeçalho `X-CSRF-Token` da sessão e recusa `Origin` de outro site. Sem CORS: outro site não lê as respostas nem envia JSON autenticado.
* Limite de tentativas: 5 falhas por IP + identificador e 20 por IP em 15 min → `429`. A mensagem de erro é a mesma para conta inexistente e senha errada.
* Identidade e papel vêm do banco. O cliente não define `user_id`, papel, autor, peso-base nem validação institucional: o servidor ignora esses campos do payload.
* **Segredo de sessão:** não existe, por desenho. Nada é assinado no cliente: a sessão é um token aleatório (`secrets.token_urlsafe`) gerado a cada login, e o servidor guarda só o SHA-256 dele no banco. Por isso não há `SECRET_KEY` para configurar, gerar ou manter estável; as sessões continuam válidas após reiniciar o servidor porque estão no banco. O `app.secret_key` do Flask fica ausente (`None`) e sem valor de reserva: se algum código futuro usar `flask.session`, o Flask recusa com erro em vez de assinar com um segredo público. As senhas ficam só como hash no banco local, que não deve ser versionado; a senha de avaliação `1234` é pública de propósito.

| Rota | Sem sessão | Quem pode |
| :--- | :--- | :--- |
| Páginas internas (7) | `302` para `index.html?destino=…` | qualquer conta |
| `GET /api/events` | `401` JSON | qualquer conta |
| `POST /api/events` (relato comunitário) | `401` JSON | qualquer conta; autor e peso-base vêm da sessão |
| `POST /api/events/<id>/confirm` (ação comunitária) | `401` JSON | qualquer conta |
| `POST /api/simulacoes/sensor` (ferramenta de simulação) | `401` JSON | qualquer conta; o servidor monta a leitura |
| `PATCH /api/events/<id>/state` (ação institucional) | `401` JSON | só Defesa Civil / CCO; outros: `403` |
| `DELETE /api/lgpd/forget/<id>` | `401` JSON | só o próprio titular; outros: `403` |

### Contas no Flask
O banco local não traz senhas. Para a avaliação, prepare as três contas com a senha pública `1234` por um comando explícito:
```bash
python app.py preparar-contas-demo
```
* O comando lista, para cada conta, se ela será **criada** (não existe no banco) ou terá a senha **redefinida**, e só continua se você digitar `SIM`.
* A senha é gravada como hash scrypt, como qualquer outra; o login continua verificando o hash, nunca texto puro. Sessões abertas dessas contas são encerradas.
* Altera só as tabelas de contas e sessões: eventos, zonas e cofre LGPD não mudam.
* Nunca roda sozinho: iniciar ou reiniciar o servidor (`python app.py`) não cria nem redefine senhas.

Para usar uma senha própria numa conta, em vez da pública: `python app.py definir-senha <mariana|roberto|lucas>` (digitada sem eco, mínimo de 12 caracteres; não use senha pessoal). Conta sem senha definida não entra.

### Logout, histórico e cache
* "Sair" fica no cabeçalho de todas as páginas internas. No Flask, a sessão só é dada como encerrada depois que o servidor a revoga; se ele não responder, a tela avisa e a sessão continua.
* O logout apaga só o estado deste usuário no navegador. Banco, eventos compartilhados e dados de outras contas não são tocados.
* Páginas e respostas da API saem com `Cache-Control: no-store`, e as páginas revalidam a sessão ao voltar pelo histórico. Isso impede reusar a sessão, mas **não torna secreto o HTML já recebido**: o que estava na tela antes do logout pode continuar em capturas, outras abas ou ferramentas do navegador. O que fica protegido são as operações e os dados servidos depois.
* O destino após o login aceita só as 7 páginas internas, com `?evento=ID` opcional. URLs externas, `//host`, `javascript:` e outros parâmetros levam ao painel.

### Testes
```bash
python -m unittest discover -s tests -v   # Flask: banco temporário, nunca o banco local
node --test tests/destino.test.mjs        # destino pós-login
```

---

## Limitações do protótipo
* **Modo estático:** login e bloqueio de páginas apenas no navegador, contornáveis; não é autenticação.
* **Flask:** execução local de desenvolvimento (`127.0.0.1`, servidor do Flask), sem HTTPS. Para implantar seria preciso, no mínimo: HTTPS com `URBAN_RISK_COOKIE_SECURE=1`, servidor WSGI de produção, limite de tentativas em armazenamento compartilhado (hoje fica em memória, por processo, e zera ao reiniciar), contas reais com cadastro e recuperação de senha (não existem aqui), expiração por inatividade e revisão de segurança independente. O limite por identificador também permite bloquear temporariamente o login de outra conta a partir do mesmo IP.
* Foto EXIF e convergência com sensor no relato são declaradas no formulário e não verificadas; a API valida tipos e tamanhos básicos, não o conteúdo.
* Login e logout não entram na trilha de auditoria (a tabela `audit_logs` continua sem uso).
* Leitura de sensor, push e entrega de notificações são simulados no navegador; não há integração com sensores, bases oficiais, filas ou WebSockets.
* Zonas, consentimentos, notificações, exportação e Direito ao Esquecimento valem só para a sessão do navegador.
* O mapa não se atualiza sozinho; a meta de atualização em até 5 s não é medida. Os indicadores não têm histórico de 24 h.
* O raio de 500 m da validação cruzada aparece no mapa, mas a distância de quem confirma não é verificada. A expiração automática de relatos (RN04) não está implementada.
* Criptografia AES-256, TLS e logs de auditoria pertencem à arquitetura-alvo; o protótipo é projetado para atender à LGPD, sem garantir conformidade.
