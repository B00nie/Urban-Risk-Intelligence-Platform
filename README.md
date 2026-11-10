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
* **Banco de Dados (`urban_risk_platform.db`):** **SQLite3** com tabelas separadas para ocorrências georreferenciadas (`risk_events`) e dados pessoais (`users_lgpd_vault`), projetado para atender à **LGPD (Lei nº 13.709/2018)**. Criptografia AES-256, TLS 1.3, JWT, Redis, MQTT e WebSockets pertencem à **arquitetura-alvo** descrita no documento do projeto e não estão implementados neste protótipo acadêmico.

---

## Mapeamento das 8 Telas Obrigatórias no Protótipo
1. **Tela 1 — Acesso por Persona e Consentimento LGPD (`RF01`, `RNF05`, `RN03`):** Seleção simulada, sem autenticação real, entre as 3 Personas (*Mariana Costa — Moradora*, *Cap. Roberto Mendes — Defesa Civil* e *Eng. Lucas Oliveira — Operador CCO*) com coleta granular de consentimento LGPD.
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
| `index.html` | **Oficial** — Tela 1: acesso (seleção de persona) e consentimento LGPD |
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
| `static/js/main.js` | Ponto de entrada: cabeçalho, barra lateral, carga dos dados e inicialização só do módulo da página |
| `static/js/core/` | `rules.js` (RN01/RN02), `data.js` (dados demonstrativos), `api.js` (API Flask), `state.js` (estado e `sessionStorage`), `actions.js` (relato, confirmação, moderação, notificações, zonas), `escape.js` (escape de HTML centralizado) |
| `static/js/components/` | `header.js`, `sidebar.js`, `toast.js`, `eventPicker.js` (evento na URL, seletor e estado vazio) |
| `static/js/pages/` | Lógica de cada uma das 8 páginas |
| `app.py` | **Oficial** — API Flask + SQLite (opcional para navegar no protótipo). Serve apenas as 8 páginas (lista fechada), marcadas para o modo API, e a pasta `static/` |
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
   O cabeçalho deve mostrar **"API Flask/SQLite conectada — dados de demonstração"**. A API de eventos fica em `http://localhost:5000/api/events`. As demais telas ficam em `http://localhost:5000/painel.html`, `/alertas.html` etc.; qualquer outro arquivo da pasta (como `app.py` ou o banco) responde 404.

   *O servidor aceita conexões apenas desta máquina (`127.0.0.1`, porta 5000) e roda com depuração desligada. É uma execução local de desenvolvimento, não uma configuração de produção.*

   *O arquivo `urban_risk_platform.db` é criado ao lado de `app.py` na primeira execução. As execuções seguintes reaproveitam o banco existente, sem apagar dados nem duplicar os registros iniciais. Para voltar ao estado inicial, pare o servidor e remova manualmente esse arquivo.*

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
* **Pelo Flask, se a API não responder,** o cabeçalho sai de "Verificando API local…" em até 5 s e assume o modo demonstrativo.
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
* Persona, consentimentos, zonas, notificações e indicações "Já Normalizou" ficam no `sessionStorage` do navegador (apagado ao fechar a aba). No modo local, os eventos também ficam ali; no modo API, os eventos sempre vêm do SQLite e as alterações (relato, sensor, confirmação, mudança de estado) são gravadas pela API. Zonas, consentimentos, notificações e "Já Normalizou" **não** são gravados no SQLite.
* **Ver no mapa:** cada notificação abre `painel.html?evento=ID`, que centraliza o mapa, abre o popup e destaca o evento na fila. O painel avisa se o evento não existir, estiver em estado final, estiver oculto pelo filtro ou se o mapa não carregar. Abrir por aí marca a notificação como lida, como os outros links dela.
* **Ocorrências ativas por categoria:** contam qualquer estado, exceto Encerrado e Descartado, no conjunto carregado no modo atual. Não mudam com o filtro do mapa, e "Eventos por Origem" continua sendo outro indicador.
* Use apenas dados fictícios nos formulários: o que é digitado fica na sessão do navegador.

### Confiança, origem e conteúdo exibido
* A faixa de confiança da RN01 ("Alta Confiança", "Confirmado pela Comunidade", "Em Validação Preliminar") e a **origem do dado** (base pública oficial, sensor IoT ou relato comunitário) aparecem em selos separados; o percentual é o mesmo calculado pela RN01.
* A prioridade (P1–P4) aparece em texto nos selos e nos marcadores do mapa, além da cor.
* Textos vindos do usuário, da API, da URL ou da sessão são exibidos como texto (escape centralizado em `static/js/core/escape.js`). Isso foi testado com entradas contendo HTML e scripts; não substitui validação no servidor, que a API ainda não faz.

### Perfis e autenticação
* A Tela 1 apenas **seleciona uma persona**; não há autenticação real. O painel de moderação (RF11) fica indisponível para a persona Moradora e as ações correspondentes são bloqueadas no JavaScript, mas isso é **restrição de interface**, não autorização segura: as rotas da API não verificam perfil.

---

## Limitações do protótipo
* Seleção de persona sem autenticação real; a restrição por perfil é só de interface, e a API não verifica perfil nem valida entradas.
* Leitura de sensor, push e entrega de notificações são simulados no navegador; não há integração com sensores, bases oficiais, filas ou WebSockets.
* Zonas, consentimentos, notificações, exportação e Direito ao Esquecimento valem só para a sessão do navegador.
* O mapa não se atualiza sozinho; a meta de atualização em até 5 s não é medida. Os indicadores não têm histórico de 24 h.
* O raio de 500 m da validação cruzada aparece no mapa, mas a distância de quem confirma não é verificada. A expiração automática de relatos (RN04) não está implementada.
* Criptografia AES-256, TLS e logs de auditoria pertencem à arquitetura-alvo; o protótipo é projetado para atender à LGPD, sem garantir conformidade.
