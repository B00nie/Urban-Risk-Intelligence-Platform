"""
GLOBAL SOLUTION 2026.2 — ENGENHARIA DE SOFTWARE (FIAP)
Tema: Urban Risk Intelligence Platform (Contexto: CitizenTech)
Integrantes:
- Bruno Seidi Ferreira Takaya — RM: 554986
- Iury Cardoso Araujo — RM: 558850
- Jhonatan Lopes Da Silva — RM: 559174

Descrição Técnica:
Back-end em Python (Flask) + Banco de Dados Relacional SQL (SQLite3) implementando:
1. Camada de Dados SQL segregada: Tabela de Eventos Georreferenciados + Cofre Isolado LGPD (users_lgpd_vault).
2. Camada Transversal de Segurança e Privacidade (LGPD - RN03): Anonimização na origem (Data Sanitizer) e truncamento de coordenadas em 100m.
3. Camada de Negócio / Motor de Regras:
   - RN01: Cálculo determinístico do Nível de Confiança (NC: 0% a 100%).
   - RN02: Cálculo do Score de Risco e Priorização de Alertas (Crítico P1, Alto P2, Moderado P3, Baixo P4).
   - Máquina de Estados UML: Reportado -> Em Validação -> Confirmado -> Alerta Emitido -> Em Monitoramento -> Encerrado / Descartado.
"""

import getpass
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from flask import Flask, abort, g, jsonify, redirect, request
from werkzeug.security import check_password_hash, generate_password_hash

# Caminhos absolutos: funciona independentemente do diretório de onde o servidor é iniciado.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# URBAN_RISK_DB_PATH permite usar um banco temporário (testes) sem tocar no banco local.
DB_PATH = os.environ.get("URBAN_RISK_DB_PATH") or os.path.join(BASE_DIR, "urban_risk_platform.db")

# Só a pasta static/ (CSS e JS do front-end) é pública. Nunca usar "." como pasta estática:
# isso expunha app.py e o banco SQLite.
app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "static"), static_url_path="/static")


# ============================================================================
# CABEÇALHOS DE RESPOSTA
# ============================================================================
# Front-end e API têm a mesma origem: não há CORS. Sem Access-Control-Allow-Origin, outro site
# não lê as respostas da API nem envia JSON com o cookie de sessão (o preflight falha).
@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    # Para outros sites só vai a origem (sem caminho nem ?evento=). "same-origin" não serve: sem Referer,
    # os tiles do OpenStreetMap respondem 403 ("Access blocked"), conforme a política de uso da OSMF.
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.path.startswith("/api/") or response.mimetype == "text/html":
        # Páginas e dados não ficam no cache: Voltar após o logout pede a página ao servidor de novo.
        response.headers["Cache-Control"] = "no-store"
    return response


# ============================================================================
# MOTOR DE REGRAS DE NEGÓCIO (RN01, RN02 E RN03 - LGPD)
# ============================================================================
def anonimizar_autor_lgpd_rn03(identificador_bruto: str, lat: float, lng: float):
    """
    RN03 (Proteção de Dados Pessoais e Anonimização na Origem - LGPD):
    - Gera hash pseudonimizado irreversível para exibição pública.
    - Trunca as coordenadas em ~100m (3 casas decimais) para proteger a residência exata do morador.
    """
    hash_curto = hashlib.sha256(identificador_bruto.encode("utf-8")).hexdigest()[:6].upper()
    autor_anonimizado = f"Morador Verificado #{hash_curto}"
    lat_truncada = round(float(lat), 3)
    lng_truncada = round(float(lng), 3)
    return autor_anonimizado, lat_truncada, lng_truncada


def calcular_nivel_confianca_rn01(
    base_weight: int,
    has_exif_media: bool,
    community_confirmations: int,
    sensor_convergence: bool,
    agent_validated: bool,
) -> int:
    """
    RN01 — Determinação do Nível de Confiança do Dado (NC: 0% a 100%):
    - Base Pública Oficial: 85% | Sensor IoT Calibrado: 80% | Relato Comunitário Único: 35%
    - Mídia com metadados EXIF válidos: +15%
    - Confirmação comunitária num raio de 500m: +15% cada (máx. +45%)
    - Convergência Sensor + Morador ou Validação por Agente Local: eleva piso para 95%
    """
    bonus_midia = 15 if has_exif_media else 0
    bonus_comunidade = min(45, max(0, int(community_confirmations)) * 15)
    nc = int(base_weight) + bonus_midia + bonus_comunidade

    if sensor_convergence or agent_validated:
        nc = max(nc, 95)

    return min(100, nc)


def calcular_score_risco_rn02(severity: int, impact: int, nc: int) -> dict:
    """
    RN02 — Pontuação e Priorização de Riscos (Score: 0 a 100):
    Fórmula: Score = [(Severidade * 15) + (Impacto * 10)] * (NC / 100)
    """
    s = max(1, min(4, int(severity)))
    i = max(1, min(4, int(impact)))
    pontos_brutos = (s * 15) + (i * 10)
    score = round(pontos_brutos * (nc / 100.0))

    if score >= 75:
        faixa, prioridade = "CRITICO", "P1"
    elif score >= 50:
        faixa, prioridade = "ALTO", "P2"
    elif score >= 30:
        faixa, prioridade = "MODERADO", "P3"
    else:
        faixa, prioridade = "BAIXO", "P4"

    return {
        "score": score,
        "riskBand": faixa,
        "priorityCode": prioridade,
        "confidence": nc,
    }


# ============================================================================
# CAMADA DE DADOS SQL (SQLITE3 COM SEGREGAÇÃO DO COFRE LGPD)
# ============================================================================
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_sql_database():
    """
    Cria o schema SQL completo caso ainda não exista e popula os dados iniciais (Seed).
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Tabela segregada: Cofre Isolado de Dados Pessoais (LGPD Vault)
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users_lgpd_vault (
            user_id TEXT PRIMARY KEY,
            full_name_encrypted TEXT NOT NULL,
            role_profile TEXT NOT NULL,
            public_hash TEXT NOT NULL,
            consent_geo INTEGER DEFAULT 1,
            consent_anon INTEGER DEFAULT 1,
            consent_push INTEGER DEFAULT 1,
            updated_at TEXT NOT NULL
        );
        """
    )

    # 2. Tabela SQL de Zonas Geográficas Monitoradas pelo Usuário (RF10)
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS monitored_zones (
            zone_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            label TEXT NOT NULL,
            region TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users_lgpd_vault (user_id)
        );
        """
    )

    # 3. Tabela SQL Principal: Eventos de Risco Urbano Georreferenciados (RF02 a RF08)
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS risk_events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            neighborhood TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            severity INTEGER NOT NULL,
            impact INTEGER NOT NULL,
            source_type TEXT NOT NULL,
            source_name TEXT NOT NULL,
            base_weight INTEGER NOT NULL,
            has_exif_media INTEGER DEFAULT 0,
            community_confirmations INTEGER DEFAULT 0,
            sensor_convergence INTEGER DEFAULT 0,
            agent_validated INTEGER DEFAULT 0,
            state TEXT NOT NULL,
            timestamp_label TEXT NOT NULL,
            sla_estimate TEXT NOT NULL,
            description TEXT NOT NULL,
            recommendations_json TEXT NOT NULL
        );
        """
    )

    # 4. Tabela SQL de Logs de Auditoria de Transparência e LGPD
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT,
            action TEXT NOT NULL,
            actor_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """
    )

    # 5. Contas de acesso: só o hash da senha (scrypt, Werkzeug). Papel definido aqui, nunca pelo cliente.
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_accounts (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            role TEXT NOT NULL,
            display_name TEXT NOT NULL,
            role_label TEXT NOT NULL,
            public_hash TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """
    )

    # 6. Sessões no servidor: o cookie leva um token aleatório; aqui fica só o SHA-256 dele.
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_sessions (
            token_hash TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            csrf_token TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            revoked_at TEXT
        );
        """
    )

    # Verifica se já existem eventos cadastrados
    cursor.execute("SELECT COUNT(*) as total FROM risk_events;")
    count = cursor.fetchone()["total"]

    if count == 0:
        # Popula Personas no Cofre LGPD
        now_iso = datetime.now().isoformat()
        personas_seed = [
            ("mariana", "AES256::Mariana_Costa", "Moradora • Transporte Público", "Morador Verificado #A8F92B", 1, 1, 1, now_iso),
            ("roberto", "AES256::Cap_Roberto_Mendes", "Agente Local • Defesa Civil", "Agente Oficial #DEFCIV-019", 1, 1, 1, now_iso),
            ("lucas", "AES256::Eng_Lucas_Oliveira", "Operador CCO • Concessionária", "Operador Técnico #CCO-402", 1, 1, 1, now_iso),
        ]
        cursor.executemany(
            """
            INSERT OR IGNORE INTO users_lgpd_vault
            (user_id, full_name_encrypted, role_profile, public_hash, consent_geo, consent_anon, consent_push, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """,
            personas_seed,
        )

        # Popula Eventos Iniciais Coerentes com o Documento de Requisitos
        seed_events = [
            (
                "EVT-2026-001",
                "Transbordamento de Córrego e Alagamento Severo",
                "ALAGAMENTO",
                "Vila Mariana (Zona Sul)",
                -23.5891,
                -46.6346,
                4,
                4,
                "PUBLIC_API",
                "Sensor Nível IoT #HIDRO-VM-09 + Defesa Civil SP",
                85,
                1,
                4,
                1,
                1,
                "Alerta Emitido",
                "Há 6 min",
                "Equipes da Defesa Civil no local • Desvio pela Av. Domingos de Morais",
                "Extravasamento detectado por régua telemétrica no Córrego da Vila Mariana com lâmina superior a 55cm.",
                json.dumps([
                    "Evite trafegar pela baixada da Vila Mariana e utilize o Metrô pelo acesso alto.",
                    "Jamais tente atravessar enxurradas a pé ou de veículo.",
                    "Acione 199 (Defesa Civil) em caso de emergência."
                ]),
            ),
            (
                "EVT-2026-002",
                "Alagamento Intransitável na Faixa de Ônibus",
                "ALAGAMENTO",
                "Av. Paulista / Bela Vista",
                -23.5641,
                -46.6524,
                3,
                3,
                "IOT_SENSOR",
                "Pluviômetro Urbano IoT #PLUV-PAU-042 + 2 Moradores",
                80,
                1,
                2,
                1,
                0,
                "Em Monitoramento",
                "Há 14 min",
                "Equipes de drenagem acionadas • Escoamento estimado em 45 min",
                "Acúmulo rápido de água (38cm) bloqueando a faixa exclusiva de ônibus e travessia.",
                json.dumps([
                    "Utilize o acesso subterrâneo do Metrô Trianon-Masp/Brigadeiro.",
                    "Linhas de ônibus operando com desvio pela Alameda Santos."
                ]),
            ),
            (
                "EVT-2026-003",
                "Queda de Energia em Setor Residencial e Semáforos",
                "ENERGIA",
                "Pinheiros (Zona Oeste)",
                -23.5672,
                -46.6938,
                3,
                3,
                "COMMUNITY",
                "Cluster de 5 Relatos Comunitários (#A8F92B e vizinhos)",
                35,
                1,
                2,
                0,
                0,
                "Alerta Emitido",
                "Há 19 min",
                "CCO Concessionária acionado • Restabelecimento estimado até 19h30",
                "Desarme de transformador deixando quarteirões sem energia elétrica e semáforos apagados.",
                json.dumps([
                    "Redobre a atenção em cruzamentos com semáforos inoperantes.",
                    "Mantenha aparelhos sensíveis desconectados da tomada."
                ]),
            ),
        ]

        cursor.executemany(
            """
            INSERT INTO risk_events (
                id, title, category, neighborhood, lat, lng, severity, impact,
                source_type, source_name, base_weight, has_exif_media,
                community_confirmations, sensor_convergence, agent_validated,
                state, timestamp_label, sla_estimate, description, recommendations_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            seed_events,
        )

    conn.commit()
    conn.close()


def serialize_event_row(row: sqlite3.Row) -> dict:
    """Converte uma linha SQL em dicionário JSON enriquecido com os cálculos RN01 e RN02."""
    nc = calcular_nivel_confianca_rn01(
        row["base_weight"],
        bool(row["has_exif_media"]),
        row["community_confirmations"],
        bool(row["sensor_convergence"]),
        bool(row["agent_validated"]),
    )
    risk_meta = calcular_score_risco_rn02(row["severity"], row["impact"], nc)

    return {
        "id": row["id"],
        "title": row["title"],
        "category": row["category"],
        "neighborhood": row["neighborhood"],
        "lat": row["lat"],
        "lng": row["lng"],
        "severity": row["severity"],
        "impact": row["impact"],
        "sourceType": row["source_type"],
        "sourceName": row["source_name"],
        "baseWeight": row["base_weight"],
        "hasExifMedia": bool(row["has_exif_media"]),
        "communityConfirmations": row["community_confirmations"],
        "sensorConvergence": bool(row["sensor_convergence"]),
        "agentValidated": bool(row["agent_validated"]),
        "state": row["state"],
        "timestamp": row["timestamp_label"],
        "slaEstimate": row["sla_estimate"],
        "description": row["description"],
        "recommendations": json.loads(row["recommendations_json"]),
        "calculatedConfidence": nc,
        "calculatedRiskScore": risk_meta["score"],
        "priorityCode": risk_meta["priorityCode"],
    }




# ============================================================================
# AUTENTICAÇÃO E AUTORIZAÇÃO (SESSÕES NO SERVIDOR)
# ============================================================================
# Cookie com token opaco aleatório; o servidor guarda só o SHA-256 dele em auth_sessions.
# Logout e troca de senha revogam a sessão no banco, e ela deixa de valer na hora.
# Não há segredo de assinatura: nada é assinado no cliente, então não existe SECRET_KEY a proteger.
SESSION_COOKIE = "urban_risk_sid"
SESSION_TTL = timedelta(hours=2)  # expiração absoluta, contada a partir do login
# Em implantação HTTPS atrás de proxy, request.is_secure pode ser falso: defina URBAN_RISK_COOKIE_SECURE=1.
COOKIE_SECURE_FORCADO = os.environ.get("URBAN_RISK_COOKIE_SECURE") == "1"
PAPEIS_INSTITUCIONAIS = ("defesa_civil", "cco")
METODOS_SEGUROS = ("GET", "HEAD", "OPTIONS")
SENHA_MINIMA = 12

# Contas de teste fictícias (personas da seção 1.2). Nenhuma senha aqui: cada uma é definida
# localmente com `python app.py definir-senha <usuario>`, e só o hash vai para o banco.
CONTAS_TESTE = {
    "mariana": {
        "email": "mariana@demo.example",
        "role": "morador",
        "display_name": "Mariana Costa",
        "role_label": "Moradora • Transporte Público",
        "public_hash": "Morador Verificado #A8F92B",
    },
    "roberto": {
        "email": "roberto@demo.example",
        "role": "defesa_civil",
        "display_name": "Cap. Roberto Mendes",
        "role_label": "Agente Local • Defesa Civil",
        "public_hash": "Agente Oficial #DEFCIV-019",
    },
    "lucas": {
        "email": "lucas@demo.example",
        "role": "cco",
        "display_name": "Eng. Lucas Oliveira",
        "role_label": "Operador CCO • Concessionária",
        "public_hash": "Operador Técnico #CCO-402",
    },
}

# Hash descartável: login com conta inexistente custa o mesmo tempo que com conta real.
_HASH_FICTICIO = generate_password_hash(secrets.token_hex(16))


def agora():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.isoformat(timespec="seconds")  # formato fixo: a comparação de texto no SQLite fica correta


def erro(status, mensagem):
    return jsonify({"error": mensagem}), status


def definir_senha_conta(user_id, senha, minimo=SENHA_MINIMA):
    """Cria ou atualiza a conta de teste com o hash da senha e encerra as sessões abertas dela.
    Só toca auth_accounts e auth_sessions: eventos, zonas e cofre LGPD não mudam."""
    dados = CONTAS_TESTE[user_id]
    if len(senha) < minimo:
        raise ValueError(f"A senha precisa ter pelo menos {minimo} caracteres.")
    conn = get_db_connection()
    conn.execute(
        """
        INSERT INTO auth_accounts (user_id, username, email, role, display_name, role_label, public_hash, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET password_hash = excluded.password_hash;
        """,
        (user_id, user_id, dados["email"], dados["role"], dados["display_name"], dados["role_label"],
         dados["public_hash"], generate_password_hash(senha), iso(agora())),
    )
    conn.execute("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL;", (iso(agora()), user_id))
    conn.commit()
    conn.close()


# --- Limite de tentativas de login ----------------------------------------------------------
# ponytail: contadores em memória, por processo; zeram ao reiniciar e não se somam entre vários
# workers. Em implantação, mover para armazenamento compartilhado (ex.: Redis) ou para o proxy.
LIMITE_JANELA_S = 15 * 60
LIMITE_POR_CONTA = 5   # falhas por (IP, identificador) na janela
LIMITE_POR_IP = 20     # falhas por IP na janela, qualquer identificador
_falhas = {}
_falhas_lock = threading.Lock()


def _falhas_recentes(chave, t):
    recentes = [x for x in _falhas.get(chave, ()) if t - x < LIMITE_JANELA_S]
    if recentes:
        _falhas[chave] = recentes
    else:
        _falhas.pop(chave, None)
    return recentes


def login_bloqueado(ip, identificador):
    t = time.monotonic()
    with _falhas_lock:
        return (len(_falhas_recentes(("ip", ip), t)) >= LIMITE_POR_IP
                or len(_falhas_recentes(("conta", ip, identificador), t)) >= LIMITE_POR_CONTA)


def registrar_falha_login(ip, identificador):
    t = time.monotonic()
    with _falhas_lock:
        for chave in (("ip", ip), ("conta", ip, identificador)):
            _falhas.setdefault(chave, []).append(t)


def limpar_falhas_login(ip, identificador):
    with _falhas_lock:
        _falhas.pop(("conta", ip, identificador), None)


# --- Sessões --------------------------------------------------------------------------------
def _hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def sessao_atual():
    """Sessão válida do cookie (não revogada e não expirada) com os dados da conta, ou None."""
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    conn = get_db_connection()
    row = conn.execute(
        """
        SELECT s.token_hash, s.csrf_token, s.expires_at,
               a.user_id, a.username, a.role, a.display_name, a.role_label, a.public_hash
        FROM auth_sessions s JOIN auth_accounts a ON a.user_id = s.user_id
        WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?;
        """,
        (_hash_token(token), iso(agora())),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def usuario_publico(conta):
    """Dados que o front-end recebe sobre a conta. O papel vem do banco, não do cliente."""
    return {
        "id": conta["user_id"],
        "username": conta["username"],
        "name": conta["display_name"],
        "role": conta["role_label"],
        "papel": conta["role"],
        "hash": conta["public_hash"],
        "isAgent": conta["role"] in PAPEIS_INSTITUCIONAIS,
    }


def origem_confiavel():
    """Navegadores enviam Origin em POST/PATCH/DELETE; se veio, precisa ser este servidor."""
    origem = request.headers.get("Origin")
    return origem is None or origem == request.host_url.rstrip("/")


@app.before_request
def proteger_api():
    """Guarda central da API: sessão obrigatória (exceto no login) e CSRF nas operações que alteram dados."""
    if not request.path.startswith("/api/"):
        return None
    if request.method not in METODOS_SEGUROS and not origem_confiavel():
        return erro(403, "Origem da requisição não permitida.")
    if request.path == "/api/auth/login":
        return None
    g.sessao = sessao_atual()
    if g.sessao is None:
        return erro(401, "Sessão ausente, expirada ou encerrada. Entre novamente.")
    if request.method not in METODOS_SEGUROS:
        enviado = request.headers.get("X-CSRF-Token", "")
        if not hmac.compare_digest(enviado.encode("utf-8"), g.sessao["csrf_token"].encode("utf-8")):
            return erro(403, "Token CSRF ausente ou inválido.")
    return None


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    """Login com usuário ou e-mail e senha. A mesma mensagem para conta inexistente e senha errada."""
    dados = request.get_json(silent=True) if request.is_json else None
    if not isinstance(dados, dict):
        return erro(400, "Envie usuário e senha em JSON.")
    identificador = str(dados.get("identifier", "")).strip().lower()[:254]
    senha = dados.get("password")
    if not identificador or not isinstance(senha, str) or not senha:
        return erro(400, "Informe usuário e senha.")

    ip = request.remote_addr or "desconhecido"
    if login_bloqueado(ip, identificador):
        resposta, status = erro(429, "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.")
        resposta.headers["Retry-After"] = str(LIMITE_JANELA_S)
        return resposta, status

    conn = get_db_connection()
    conta = conn.execute(
        "SELECT user_id, username, role, display_name, role_label, public_hash, password_hash "
        "FROM auth_accounts WHERE username = ? OR email = ?;",
        (identificador, identificador),
    ).fetchone()
    senha_ok = check_password_hash(conta["password_hash"] if conta else _HASH_FICTICIO, senha[:1024])
    if not (conta and senha_ok):
        conn.close()
        registrar_falha_login(ip, identificador)
        return erro(401, "Usuário ou senha inválidos.")
    limpar_falhas_login(ip, identificador)

    # Token novo a cada login (evita fixação de sessão); a sessão anterior deste navegador é revogada.
    t = agora()
    anterior = request.cookies.get(SESSION_COOKIE)
    if anterior:
        conn.execute("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ?;", (iso(t), _hash_token(anterior)))
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    expira = t + SESSION_TTL
    conn.execute(
        "INSERT INTO auth_sessions (token_hash, user_id, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?);",
        (_hash_token(token), conta["user_id"], csrf, iso(t), iso(expira)),
    )
    conn.commit()
    conn.close()

    resposta = jsonify({"user": usuario_publico(conta), "csrfToken": csrf, "expiresAt": iso(expira)})
    resposta.set_cookie(
        SESSION_COOKIE, token, max_age=int(SESSION_TTL.total_seconds()), path="/",
        httponly=True, samesite="Lax", secure=COOKIE_SECURE_FORCADO or request.is_secure,
    )
    return resposta, 200


@app.route("/api/auth/session", methods=["GET"])
def auth_session():
    """Sessão atual (a guarda central já respondeu 401 se não houver)."""
    return jsonify({"user": usuario_publico(g.sessao), "csrfToken": g.sessao["csrf_token"], "expiresAt": g.sessao["expires_at"]}), 200


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    """Revoga a sessão no servidor: o mesmo cookie deixa de ser aceito, mesmo se for reenviado."""
    conn = get_db_connection()
    conn.execute("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ?;", (iso(agora()), g.sessao["token_hash"]))
    conn.commit()
    conn.close()
    resposta = jsonify({"status": "logged_out"})
    resposta.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="Lax")
    return resposta, 200


# ============================================================================
# ROTAS RESTFUL DA API E ENTREGA DO FRONT-END
# ============================================================================
# Lista fechada das 8 páginas do front-end: nenhum outro arquivo da raiz é servido.
PAGINA_LOGIN = "index.html"
FRONTEND_PAGES = {
    "index.html",
    "painel.html",
    "alertas.html",
    "detalhes.html",
    "confianca.html",
    "registro.html",
    "notificacoes.html",
    "perfil.html",
}


def pagina_com_api(page):
    """Entrega a página marcada para o modo API. Sem esta marca (hospedagem estática), o front-end não consulta API."""
    with open(os.path.join(BASE_DIR, page), encoding="utf-8") as f:
        html = f.read()
    return html.replace("<head>", '<head>\n    <meta name="urban-risk-api" content="api">', 1)


@app.route("/")
def serve_frontend():
    """Entrega a Tela 1 (login). Quem já tem sessão é levado adiante pelo próprio front-end."""
    return pagina_com_api(PAGINA_LOGIN)


@app.route("/<page>")
def serve_frontend_page(page):
    """Entrega uma das 8 páginas; as internas exigem sessão válida. Qualquer outro nome retorna 404."""
    if page not in FRONTEND_PAGES:
        abort(404)
    if page != PAGINA_LOGIN and sessao_atual() is None:
        # Destino montado aqui a partir da lista fechada; o login valida de novo antes de usar.
        destino = page
        evento = request.args.get("evento")
        if evento:
            destino += "?evento=" + quote(evento, safe="")
        return redirect("/" + PAGINA_LOGIN + "?destino=" + quote(destino, safe="") + "&motivo=sessao", code=302)
    return pagina_com_api(page)


@app.route("/api/events", methods=["GET"])
def list_events():
    """RF02 / RF04: Lista todos os eventos ordenados de forma decrescente pelo Score de Risco (RN02)."""
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM risk_events;").fetchall()
    conn.close()

    events = [serialize_event_row(r) for r in rows]
    events.sort(key=lambda x: x["calculatedRiskScore"], reverse=True)
    return jsonify(events), 200


CATEGORIAS = {"ALAGAMENTO", "CALOR", "ENERGIA", "AGUA", "TRANSPORTE"}


def _texto(valor, limite):
    return valor.strip()[:limite] if isinstance(valor, str) else ""


def inserir_evento(campos):
    """Grava um evento novo com id gerado pelo servidor (nunca sobrescreve) e o devolve serializado."""
    nc = calcular_nivel_confianca_rn01(
        campos["base_weight"], campos["has_exif_media"], campos["community_confirmations"],
        campos["sensor_convergence"], campos["agent_validated"],
    )
    estado_inicial = "Alerta Emitido" if nc >= 50 else "Em Validação"
    event_id = f"EVT-{datetime.now():%Y}-{secrets.token_hex(3).upper()}"
    conn = get_db_connection()
    conn.execute(
        """
        INSERT INTO risk_events (
            id, title, category, neighborhood, lat, lng, severity, impact,
            source_type, source_name, base_weight, has_exif_media,
            community_confirmations, sensor_convergence, agent_validated,
            state, timestamp_label, sla_estimate, description, recommendations_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        (
            event_id, campos["title"], campos["category"], campos["neighborhood"], campos["lat"], campos["lng"],
            campos["severity"], campos["impact"], campos["source_type"], campos["source_name"], campos["base_weight"],
            int(campos["has_exif_media"]), campos["community_confirmations"], int(campos["sensor_convergence"]),
            int(campos["agent_validated"]), estado_inicial, campos["timestamp_label"], campos["sla_estimate"],
            campos["description"], json.dumps(campos["recommendations"]),
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM risk_events WHERE id = ?;", (event_id,)).fetchone()
    conn.close()
    return serialize_event_row(row)


@app.route("/api/events", methods=["POST"])
def create_event():
    """
    RF07: Relato comunitário. Autor, origem, peso-base (35%) e validação institucional vêm da sessão,
    não do payload; aplica a anonimização LGPD (RN03), calcula a Confiança (RN01) e o Risco (RN02).
    """
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return erro(400, "Envie o relato em JSON.")
    if payload.get("category") not in CATEGORIAS:
        return erro(400, "Categoria inválida.")
    try:
        severity = max(1, min(4, int(payload.get("severity", 3))))
        impact = max(1, min(4, int(payload.get("impact", 3))))
        _, lat_trunc, lng_trunc = anonimizar_autor_lgpd_rn03("", payload.get("lat", -23.5641), payload.get("lng", -46.6524))
    except (TypeError, ValueError):
        return erro(400, "Severidade, impacto ou coordenadas inválidos.")

    sensor = bool(payload.get("sensorConvergence"))  # declarado no formulário (demonstração; não verificado)
    recomendacoes = payload.get("recommendations")
    recomendacoes = [_texto(r, 300) for r in recomendacoes if isinstance(r, str)][:5] if isinstance(recomendacoes, list) else []
    evento = inserir_evento({
        "title": _texto(payload.get("title"), 160) or "Ocorrência Reportada",
        "category": payload["category"],
        "neighborhood": _texto(payload.get("neighborhood"), 120) or "São Paulo",
        "lat": lat_trunc,
        "lng": lng_trunc,
        "severity": severity,
        "impact": impact,
        "source_type": "COMMUNITY",
        "source_name": f"Relato Comunitário ({g.sessao['public_hash']})" + (" + Sensor IoT" if sensor else ""),
        "base_weight": 35,
        "has_exif_media": bool(payload.get("hasExifMedia")),
        "community_confirmations": 0,
        "sensor_convergence": sensor,
        "agent_validated": g.sessao["role"] in PAPEIS_INSTITUCIONAIS,
        "timestamp_label": "Agora (< 2s)",
        "sla_estimate": _texto(payload.get("slaEstimate"), 200) or "Processado pelo Motor de Regras",
        "description": _texto(payload.get("description"), 2000),
        "recommendations": recomendacoes or ["Mantenha atenção na área sinalizada."],
    })
    return jsonify({"status": "created", "event": evento, "calculatedConfidence": evento["calculatedConfidence"], "state": evento["state"]}), 201


@app.route("/api/simulacoes/sensor", methods=["POST"])
def simulate_sensor_event():
    """RF03 (ferramenta de simulação): o servidor monta a leitura fictícia; o payload do cliente é ignorado."""
    evento = inserir_evento({
        "title": "Pico Pluviométrico Súbito e Risco de Enxurrada",
        "category": "ALAGAMENTO",
        "neighborhood": "Mooca / Tamanduateí (Zona Leste)",
        "lat": -23.5625,
        "lng": -46.5990,
        "severity": 4,
        "impact": 3,
        "source_type": "IOT_SENSOR",
        "source_name": "Estação Telemétrica IoT #PLUV-ZL-108 (leitura simulada)",
        "base_weight": 80,
        "has_exif_media": False,
        "community_confirmations": 1,
        "sensor_convergence": True,
        "agent_validated": False,
        "timestamp_label": "Agora (simulado)",
        "sla_estimate": "Alerta gerado pelo motor de regras a partir de leitura simulada",
        "description": "Sensor acusou precipitação de 62mm/h e elevação rápida do nível do canal. Alerta emitido automaticamente pelo Motor de Regras.",
        "recommendations": [
            "Evite a Av. do Estado e vias marginais do Rio Tamanduateí.",
            "Acompanhe o nível da água em tempo real pelo painel.",
        ],
    })
    return jsonify({"status": "created", "event": evento}), 201


# Transições do Diagrama de Estados aceitas por PATCH /state (espelha STATE_TRANSITIONS em core/data.js).
# "Alerta Emitido" -> "Alerta Emitido" é a validação oficial de um alerta já emitido (piso de 95%, RN01).
TRANSICOES_CICLO_DE_VIDA = {
    "Em Validação": ("Alerta Emitido", "Descartado"),
    "Confirmado": ("Alerta Emitido",),
    "Alerta Emitido": ("Alerta Emitido", "Em Monitoramento"),
    "Em Monitoramento": ("Alerta Emitido", "Encerrado", "Descartado"),
    "Encerrado": (),
    "Descartado": (),
}


@app.route("/api/events/<event_id>/confirm", methods=["POST"])
def confirm_event_cross_validation(event_id):
    """RF08 (ação comunitária, qualquer perfil): incrementa a validação cruzada (+15% de confiança RN01) no SQL."""
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM risk_events WHERE id = ?;", (event_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Evento não encontrado"}), 404
    if row["state"] in ("Encerrado", "Descartado"):
        conn.close()
        return jsonify({"error": f"Evento em estado final: {row['state']}"}), 409

    new_confirmations = row["community_confirmations"] + 1
    nc = calcular_nivel_confianca_rn01(
        row["base_weight"],
        bool(row["has_exif_media"]),
        new_confirmations,
        bool(row["sensor_convergence"]),
        bool(row["agent_validated"]),
    )
    new_state = "Alerta Emitido" if (row["state"] == "Em Validação" and nc >= 50) else row["state"]

    conn.execute(
        "UPDATE risk_events SET community_confirmations = ?, state = ? WHERE id = ?;",
        (new_confirmations, new_state, event_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "confirmed", "communityConfirmations": new_confirmations, "confidence": nc, "state": new_state}), 200


@app.route("/api/events/<event_id>/state", methods=["PATCH"])
def update_event_lifecycle_state(event_id):
    """RF11 (ação institucional): só Defesa Civil / CCO alteram o ciclo de vida; o papel vem da sessão."""
    if g.sessao["role"] not in PAPEIS_INSTITUCIONAIS:
        return erro(403, "Ação restrita a perfis institucionais (Defesa Civil / CCO).")
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        payload = {}
    new_state = payload.get("state", "Em Monitoramento")
    agent_val = 1 if payload.get("agentValidated") else 0

    conn = get_db_connection()
    row = conn.execute("SELECT state FROM risk_events WHERE id = ?;", (event_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Evento não encontrado"}), 404
    if not isinstance(new_state, str) or new_state not in TRANSICOES_CICLO_DE_VIDA.get(row["state"], ()):
        conn.close()
        return jsonify({"error": f"Transição não prevista: {row['state']} -> {new_state}"}), 409

    conn.execute(
        "UPDATE risk_events SET state = ?, agent_validated = CASE WHEN ? = 1 THEN 1 ELSE agent_validated END WHERE id = ?;",
        (new_state, agent_val, event_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "updated", "eventId": event_id, "newState": new_state}), 200


@app.route("/api/lgpd/forget/<user_id>", methods=["DELETE"])
def lgpd_right_to_be_forgotten(user_id):
    """RNF05 / RF10: Direito ao Esquecimento (Art. 18 LGPD) no Cofre Isolado SQL — só dos próprios dados."""
    if user_id != g.sessao["user_id"]:
        return erro(403, "Só é possível excluir os próprios dados.")
    conn = get_db_connection()
    conn.execute("DELETE FROM monitored_zones WHERE user_id = ?;", (user_id,))
    conn.execute("DELETE FROM users_lgpd_vault WHERE user_id = ?;", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "deleted", "message": "Dados pessoais excluídos permanentemente do Cofre LGPD."}), 200


def comando_definir_senha(args):
    """python app.py definir-senha <usuario>: pede a senha no terminal (sem eco) e grava só o hash."""
    if len(args) != 1 or args[0] not in CONTAS_TESTE:
        print(f"Uso: python app.py definir-senha <{'|'.join(CONTAS_TESTE)}>")
        return 2
    senha = getpass.getpass(f"Nova senha para '{args[0]}' (mín. {SENHA_MINIMA} caracteres; não use senha pessoal): ")
    if senha != getpass.getpass("Repita a senha: "):
        print("As senhas não coincidem. Nada foi alterado.")
        return 1
    try:
        definir_senha_conta(args[0], senha)
    except ValueError as e:
        print(f"{e} Nada foi alterado.")
        return 1
    print(f"Senha definida para '{args[0]}' ({CONTAS_TESTE[args[0]]['role']}). Sessões abertas dessa conta foram encerradas.")
    return 0


# Credencial pública da avaliação acadêmica (mesma do modo estático). Não é senha pessoal nem recomendação de uso real.
SENHA_DEMO_AVALIACAO = "1234"


def preparar_contas_demo():
    """Define a senha pública de avaliação nas três contas fictícias (hash scrypt, como qualquer senha).
    Retorna {usuario: 'criada' | 'redefinida'}. Só é chamada pelo comando explícito, nunca na inicialização."""
    conn = get_db_connection()
    existentes = {r["user_id"] for r in conn.execute("SELECT user_id FROM auth_accounts;")}
    conn.close()
    situacao = {}
    for user_id in CONTAS_TESTE:
        situacao[user_id] = "redefinida" if user_id in existentes else "criada"
        definir_senha_conta(user_id, SENHA_DEMO_AVALIACAO, minimo=len(SENHA_DEMO_AVALIACAO))
    return situacao


def comando_preparar_contas_demo():
    """python app.py preparar-contas-demo: avisa o que vai criar/redefinir e só segue com confirmação."""
    conn = get_db_connection()
    existentes = {r["user_id"] for r in conn.execute("SELECT user_id FROM auth_accounts;")}
    conn.close()
    print("ATENÇÃO: este comando cria ou REDEFINE credenciais PÚBLICAS de demonstração acadêmica.")
    print(f"Banco: {DB_PATH}")
    for user_id, dados in CONTAS_TESTE.items():
        acao = "REDEFINIR a senha (a atual será substituída)" if user_id in existentes else "CRIAR a conta (não existe neste banco)"
        print(f"  - {user_id} ({dados['role']}): {acao}")
    print("A senha de todas passa a ser a senha pública de avaliação documentada no README.")
    print("Sessões abertas dessas contas serão encerradas. Eventos, zonas e cofre LGPD não são alterados.")
    if input("Digite SIM para continuar: ").strip() != "SIM":
        print("Cancelado. Nada foi alterado.")
        return 1
    for user_id, acao in preparar_contas_demo().items():
        print(f"  {user_id}: {acao}")
    print("Contas de demonstração prontas.")
    return 0


if __name__ == "__main__":
    init_sql_database()
    if sys.argv[1:2] == ["definir-senha"]:
        sys.exit(comando_definir_senha(sys.argv[2:]))
    if sys.argv[1:] == ["preparar-contas-demo"]:
        sys.exit(comando_preparar_contas_demo())
    print("=====================================================================")
    print(" URBAN RISK INTELLIGENCE PLATFORM — SERVIDOR PYTHON + SQL ATIVO")
    print(" Acesse no navegador: http://localhost:5000")
    print(" Contas de avaliação: python app.py preparar-contas-demo (uma vez, explícito)")
    print("=====================================================================")
    # Execução local de desenvolvimento (não é configuração de produção).
    # Só aceita conexões desta máquina; depuração apenas se URBAN_RISK_DEBUG=1 for definido explicitamente.
    app.run(host="127.0.0.1", port=5000, debug=os.environ.get("URBAN_RISK_DEBUG") == "1")
