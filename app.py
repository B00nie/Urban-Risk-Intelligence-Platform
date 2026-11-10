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

import hashlib
import json
import os
import sqlite3
from datetime import datetime
from flask import Flask, abort, jsonify, request

# Caminhos absolutos: funciona independentemente do diretório de onde o servidor é iniciado.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "urban_risk_platform.db")

# Só a pasta static/ (CSS e JS do front-end) é pública. Nunca usar "." como pasta estática:
# isso expunha app.py e o banco SQLite.
app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "static"), static_url_path="/static")


# ============================================================================
# CONFIGURAÇÃO CORS PARA COMUNICAÇÃO FRONT-END <-> BACK-END
# ============================================================================
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,DELETE,OPTIONS"
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
# ROTAS RESTFUL DA API E ENTREGA DO FRONT-END
# ============================================================================
# Lista fechada das 8 páginas do front-end: nenhum outro arquivo da raiz é servido.
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
    """Entrega a Tela 1 (index.html) do protótipo de 8 telas."""
    return pagina_com_api("index.html")


@app.route("/<page>")
def serve_frontend_page(page):
    """Entrega uma das 8 páginas do protótipo; qualquer outro nome retorna 404."""
    if page not in FRONTEND_PAGES:
        abort(404)
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


@app.route("/api/events", methods=["POST"])
def create_event():
    """
    RF03 / RF07: Recebe um novo evento (Sensor IoT, API Pública ou Relato Comunitário),
    aplica a anonimização LGPD (RN03), calcula a Confiança (RN01) e o Risco (RN02) e grava em SQL.
    """
    payload = request.get_json(force=True)
    autor_hash, lat_trunc, lng_trunc = anonimizar_autor_lgpd_rn03(
        payload.get("sourceName", "Morador"),
        payload.get("lat", -23.5641),
        payload.get("lng", -46.6524),
    )

    nc = calcular_nivel_confianca_rn01(
        payload.get("baseWeight", 35),
        payload.get("hasExifMedia", False),
        payload.get("communityConfirmations", 0),
        payload.get("sensorConvergence", False),
        payload.get("agentValidated", False),
    )
    estado_inicial = "Alerta Emitido" if nc >= 50 else "Em Validação"

    conn = get_db_connection()
    conn.execute(
        """
        INSERT OR REPLACE INTO risk_events (
            id, title, category, neighborhood, lat, lng, severity, impact,
            source_type, source_name, base_weight, has_exif_media,
            community_confirmations, sensor_convergence, agent_validated,
            state, timestamp_label, sla_estimate, description, recommendations_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        (
            payload.get("id", f"EVT-{int(datetime.now().timestamp())}"),
            payload.get("title", "Ocorrência Reportada"),
            payload.get("category", "ALAGAMENTO"),
            payload.get("neighborhood", "São Paulo"),
            lat_trunc,
            lng_trunc,
            int(payload.get("severity", 3)),
            int(payload.get("impact", 3)),
            payload.get("sourceType", "COMMUNITY"),
            payload.get("sourceName", autor_hash),
            int(payload.get("baseWeight", 35)),
            1 if payload.get("hasExifMedia") else 0,
            int(payload.get("communityConfirmations", 0)),
            1 if payload.get("sensorConvergence") else 0,
            1 if payload.get("agentValidated") else 0,
            estado_inicial,
            "Agora (< 2s)",
            payload.get("slaEstimate", "Processado pelo Motor de Regras"),
            payload.get("description", ""),
            json.dumps(payload.get("recommendations", ["Mantenha atenção na área sinalizada."])),
        ),
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "created", "calculatedConfidence": nc, "state": estado_inicial}), 201


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
    """RF08: Incrementa a validação cruzada comunitária (+15% de confiança RN01) no SQL."""
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
    """RF11: Permite que agentes locais (Defesa Civil / CCO) alterem o estado do ciclo de vida do evento."""
    payload = request.get_json(force=True)
    new_state = payload.get("state", "Em Monitoramento")
    agent_val = 1 if payload.get("agentValidated") else 0

    conn = get_db_connection()
    row = conn.execute("SELECT state FROM risk_events WHERE id = ?;", (event_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Evento não encontrado"}), 404
    if new_state not in TRANSICOES_CICLO_DE_VIDA.get(row["state"], ()):
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
    """RNF05 / RF10: Executa o Direito ao Esquecimento (Art. 18 LGPD) no Cofre Isolado SQL."""
    conn = get_db_connection()
    conn.execute("DELETE FROM monitored_zones WHERE user_id = ?;", (user_id,))
    conn.execute("DELETE FROM users_lgpd_vault WHERE user_id = ?;", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "deleted", "message": "Dados pessoais excluídos permanentemente do Cofre LGPD."}), 200


if __name__ == "__main__":
    init_sql_database()
    print("=====================================================================")
    print(" URBAN RISK INTELLIGENCE PLATFORM — SERVIDOR PYTHON + SQL ATIVO")
    print(" Acesse no navegador: http://localhost:5000")
    print("=====================================================================")
    # Execução local de desenvolvimento (não é configuração de produção).
    # Só aceita conexões desta máquina; depuração apenas se URBAN_RISK_DEBUG=1 for definido explicitamente.
    app.run(host="127.0.0.1", port=5000, debug=os.environ.get("URBAN_RISK_DEBUG") == "1")