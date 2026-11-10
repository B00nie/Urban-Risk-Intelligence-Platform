"""
Testes de autenticação e autorização da API Flask (banco SQLite temporário; o banco local não é tocado).
Executar na raiz do projeto:  python -m unittest discover -s tests -v
"""
import os
import secrets
import sqlite3
import sys
import tempfile
import unittest

_TMP = tempfile.TemporaryDirectory()
os.environ["URBAN_RISK_DB_PATH"] = os.path.join(_TMP.name, "teste.db")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app as servidor  # noqa: E402  (precisa da variável de ambiente acima)

# Senhas geradas a cada execução: nenhuma senha fica no código nem no repositório.
SENHAS = {conta: secrets.token_urlsafe(18) for conta in ("mariana", "roberto")}


def setUpModule():
    assert servidor.DB_PATH.startswith(_TMP.name), "os testes só podem usar o banco temporário"
    servidor.init_sql_database()
    for conta, senha in SENHAS.items():
        servidor.definir_senha_conta(conta, senha)


def tearDownModule():
    _TMP.cleanup()


def sql(query, params=()):
    conn = sqlite3.connect(servidor.DB_PATH)
    try:
        rows = conn.execute(query, params).fetchall()
        conn.commit()
        return rows
    finally:
        conn.close()


class Base(unittest.TestCase):
    def setUp(self):
        servidor._falhas.clear()
        self.client = servidor.app.test_client()

    def login(self, conta="mariana", senha=None, client=None):
        client = client or self.client
        res = client.post("/api/auth/login", json={"identifier": conta, "password": senha or SENHAS[conta]})
        self.assertEqual(res.status_code, 200, res.get_json())
        return res.get_json()["csrfToken"]

    def cookie(self, client=None):
        return (client or self.client).get_cookie(servidor.SESSION_COOKIE)


class TestPaginasEApiSemSessao(Base):
    def test_paginas_internas_redirecionam_para_login(self):
        res = self.client.get("/painel.html")
        self.assertEqual(res.status_code, 302)
        self.assertEqual(res.headers["Location"], "/index.html?destino=painel.html&motivo=sessao")
        res = self.client.get("/detalhes.html?evento=EVT-2026-001")
        self.assertEqual(res.headers["Location"], "/index.html?destino=detalhes.html%3Fevento%3DEVT-2026-001&motivo=sessao")

    def test_login_e_publico_e_arquivos_fora_da_lista_dao_404(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        self.assertEqual(self.client.get("/index.html").status_code, 200)
        for caminho in ("/app.py", "/urban_risk_platform.db", "/README.md"):
            self.assertEqual(self.client.get(caminho).status_code, 404, caminho)

    def test_api_sem_sessao_responde_401_json(self):
        chamadas = [
            ("GET", "/api/events"), ("POST", "/api/events"), ("POST", "/api/events/EVT-2026-001/confirm"),
            ("PATCH", "/api/events/EVT-2026-001/state"), ("POST", "/api/simulacoes/sensor"),
            ("DELETE", "/api/lgpd/forget/mariana"), ("GET", "/api/auth/session"), ("POST", "/api/auth/logout"),
        ]
        for metodo, caminho in chamadas:
            res = self.client.open(caminho, method=metodo, json={})
            self.assertEqual(res.status_code, 401, f"{metodo} {caminho}")
            self.assertEqual(res.mimetype, "application/json")
            self.assertNotIn("Location", res.headers)

    def test_cabecalhos_sem_cors_e_sem_cache(self):
        res = self.client.get("/api/events")
        self.assertNotIn("Access-Control-Allow-Origin", res.headers)
        self.assertEqual(res.headers["Cache-Control"], "no-store")
        self.assertEqual(self.client.get("/").headers["Cache-Control"], "no-store")
        # Tiles do OpenStreetMap exigem Referer com a origem; caminho e ?evento= não vazam
        self.assertEqual(self.client.get("/").headers["Referrer-Policy"], "strict-origin-when-cross-origin")


class TestLogin(Base):
    def test_login_valido_por_usuario_ou_email(self):
        res = self.client.post("/api/auth/login", json={"identifier": "Mariana@Demo.Example", "password": SENHAS["mariana"]})
        self.assertEqual(res.status_code, 200)
        dados = res.get_json()
        self.assertEqual(dados["user"]["papel"], "morador")
        self.assertFalse(dados["user"]["isAgent"])
        self.assertNotIn("password_hash", str(dados))
        self.assertEqual(self.client.get("/painel.html").status_code, 200)

    def test_cookie_httponly_samesite_e_secure_em_https(self):
        res = self.client.post("/api/auth/login", json={"identifier": "mariana", "password": SENHAS["mariana"]})
        cabecalho = res.headers["Set-Cookie"]
        self.assertIn("HttpOnly", cabecalho)
        self.assertIn("SameSite=Lax", cabecalho)
        self.assertNotIn("Secure", cabecalho)  # HTTP local
        https = servidor.app.test_client()
        res = https.post("/api/auth/login", base_url="https://localhost",
                         json={"identifier": "mariana", "password": SENHAS["mariana"]})
        self.assertIn("Secure", res.headers["Set-Cookie"])

    def test_mesma_mensagem_para_senha_errada_e_conta_inexistente(self):
        errada = self.client.post("/api/auth/login", json={"identifier": "mariana", "password": "x" * 14})
        inexistente = self.client.post("/api/auth/login", json={"identifier": "ninguem", "password": "x" * 14})
        self.assertEqual(errada.status_code, 401)
        self.assertEqual(inexistente.status_code, 401)
        self.assertEqual(errada.get_json(), inexistente.get_json())
        self.assertIsNone(self.cookie())

    def test_lucas_sem_senha_definida_nao_entra(self):
        res = self.client.post("/api/auth/login", json={"identifier": "lucas", "password": "qualquer-coisa-123"})
        self.assertEqual(res.status_code, 401)

    def test_login_exige_json(self):
        res = self.client.post("/api/auth/login", data={"identifier": "mariana", "password": SENHAS["mariana"]})
        self.assertEqual(res.status_code, 400)

    def test_login_de_outra_origem_recusado(self):
        res = self.client.post("/api/auth/login", headers={"Origin": "https://atacante.example"},
                               json={"identifier": "mariana", "password": SENHAS["mariana"]})
        self.assertEqual(res.status_code, 403)

    def test_limite_de_tentativas(self):
        for _ in range(servidor.LIMITE_POR_CONTA):
            self.assertEqual(self.client.post("/api/auth/login", json={"identifier": "mariana", "password": "errada-123456"}).status_code, 401)
        bloqueado = self.client.post("/api/auth/login", json={"identifier": "mariana", "password": SENHAS["mariana"]})
        self.assertEqual(bloqueado.status_code, 429)  # nem a senha certa passa durante o bloqueio
        self.assertIn("Retry-After", bloqueado.headers)
        # Conta inexistente bloqueia do mesmo jeito (não revela existência)
        for _ in range(servidor.LIMITE_POR_CONTA):
            self.client.post("/api/auth/login", json={"identifier": "fantasma", "password": "errada-123456"})
        self.assertEqual(self.client.post("/api/auth/login", json={"identifier": "fantasma", "password": "x"}).status_code, 429)
        # Outra conta do mesmo IP ainda entra (limite por IP é mais alto)
        self.login("roberto")

    def test_limite_por_ip(self):
        for i in range(servidor.LIMITE_POR_IP):
            self.client.post("/api/auth/login", json={"identifier": f"conta{i}", "password": "errada-123456"})
        self.assertEqual(self.client.post("/api/auth/login", json={"identifier": "roberto", "password": SENHAS["roberto"]}).status_code, 429)


class TestSessao(Base):
    def test_sessao_atual_vem_do_servidor(self):
        self.login("roberto")
        dados = self.client.get("/api/auth/session").get_json()
        self.assertEqual(dados["user"]["id"], "roberto")
        self.assertTrue(dados["user"]["isAgent"])
        self.assertTrue(dados["csrfToken"])

    def test_logout_revoga_e_cookie_antigo_nao_volta_a_valer(self):
        csrf = self.login()
        token = self.cookie().value
        res = self.client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(self.cookie())
        # Reenvia o cookie revogado manualmente
        self.client.set_cookie(servidor.SESSION_COOKIE, token)
        self.assertEqual(self.client.get("/api/events").status_code, 401)
        self.assertEqual(self.client.get("/painel.html").status_code, 302)
        self.assertIsNotNone(sql("SELECT revoked_at FROM auth_sessions WHERE token_hash = ?;", (servidor._hash_token(token),))[0][0])

    def test_logout_exige_csrf(self):
        self.login()
        self.assertEqual(self.client.post("/api/auth/logout").status_code, 403)
        self.assertEqual(self.client.get("/api/auth/session").status_code, 200)  # continua ativa

    def test_sessao_expirada(self):
        self.login()
        sql("UPDATE auth_sessions SET expires_at = '2000-01-01T00:00:00+00:00' WHERE token_hash = ?;",
            (servidor._hash_token(self.cookie().value),))
        self.assertEqual(self.client.get("/api/auth/session").status_code, 401)
        self.assertEqual(self.client.get("/alertas.html").status_code, 302)

    def test_troca_de_senha_revoga_sessoes(self):
        outro = servidor.app.test_client()
        self.login("roberto", client=outro)
        nova = secrets.token_urlsafe(18)
        servidor.definir_senha_conta("roberto", nova)
        SENHAS["roberto"] = nova
        self.assertEqual(outro.get("/api/auth/session").status_code, 401)

    def test_novo_login_troca_o_token(self):
        self.login()
        antigo = self.cookie().value
        self.login()
        self.assertNotEqual(antigo, self.cookie().value)
        self.client.set_cookie(servidor.SESSION_COOKIE, antigo)
        self.assertEqual(self.client.get("/api/auth/session").status_code, 401)

    def test_senha_curta_recusada(self):
        with self.assertRaises(ValueError):
            servidor.definir_senha_conta("lucas", "curta")


class TestCsrfEAutorizacao(Base):
    def test_csrf_ausente_ou_invalido(self):
        self.login()
        self.assertEqual(self.client.post("/api/events/EVT-2026-001/confirm").status_code, 403)
        self.assertEqual(self.client.post("/api/events/EVT-2026-001/confirm", headers={"X-CSRF-Token": "falso"}).status_code, 403)

    def test_origem_externa_recusada_mesmo_com_csrf(self):
        csrf = self.login()
        res = self.client.post("/api/events/EVT-2026-002/confirm", headers={"X-CSRF-Token": csrf, "Origin": "https://atacante.example"})
        self.assertEqual(res.status_code, 403)

    def test_morador_nao_modera_mesmo_alterando_payload(self):
        csrf = self.login("mariana")
        for payload in ({"state": "Em Monitoramento"},
                        {"state": "Em Monitoramento", "role": "defesa_civil", "papel": "defesa_civil", "isAgent": True, "user_id": "roberto"}):
            res = self.client.patch("/api/events/EVT-2026-001/state", json=payload, headers={"X-CSRF-Token": csrf})
            self.assertEqual(res.status_code, 403)
        self.assertEqual(sql("SELECT state FROM risk_events WHERE id = 'EVT-2026-001';")[0][0], "Alerta Emitido")

    def test_agente_modera_e_transicao_invalida_continua_409(self):
        csrf = self.login("roberto")
        alvo = self._criar_relato(csrf)["id"]
        res = self.client.patch(f"/api/events/{alvo}/state", json={"state": "Encerrado"}, headers={"X-CSRF-Token": csrf})
        self.assertEqual(res.status_code, 409)  # Alerta Emitido -> Encerrado não é previsto
        res = self.client.patch(f"/api/events/{alvo}/state", json={"state": "Em Monitoramento"}, headers={"X-CSRF-Token": csrf})
        self.assertEqual(res.status_code, 200)

    def _criar_relato(self, csrf, **extra):
        payload = {"category": "ALAGAMENTO", "neighborhood": "Pinheiros", "lat": -23.56789, "lng": -46.69123,
                   "severity": 3, "impact": 3, "title": "Teste", "description": "Teste", **extra}
        res = self.client.post("/api/events", json=payload, headers={"X-CSRF-Token": csrf})
        self.assertEqual(res.status_code, 201, res.get_json())
        return res.get_json()["event"]

    def test_payload_adulterado_nao_define_autor_papel_nem_peso(self):
        csrf = self.login("mariana")
        evento = self._criar_relato(
            csrf, id="EVT-2026-001", agentValidated=True, baseWeight=100, sourceType="PUBLIC_API",
            sourceName="Defesa Civil SP", role="defesa_civil", user_id="roberto", communityConfirmations=9,
        )
        self.assertNotEqual(evento["id"], "EVT-2026-001")
        self.assertFalse(evento["agentValidated"])
        self.assertEqual(evento["baseWeight"], 35)
        self.assertEqual(evento["sourceType"], "COMMUNITY")
        self.assertEqual(evento["communityConfirmations"], 0)
        self.assertEqual(evento["sourceName"], "Relato Comunitário (Morador Verificado #A8F92B)")
        self.assertEqual(evento["calculatedConfidence"], 35)   # RN01: 35% base, sem bônus
        self.assertEqual(evento["state"], "Em Validação")       # NC < 50%
        self.assertEqual((evento["lat"], evento["lng"]), (-23.568, -46.691))  # RN03: 3 casas
        # O evento semente não foi sobrescrito
        self.assertEqual(sql("SELECT title FROM risk_events WHERE id = 'EVT-2026-001';")[0][0],
                         "Transbordamento de Córrego e Alagamento Severo")

    def test_relato_de_agente_recebe_validacao_institucional_pelo_papel(self):
        csrf = self.login("roberto")
        evento = self._criar_relato(csrf)
        self.assertTrue(evento["agentValidated"])
        self.assertEqual(evento["calculatedConfidence"], 95)
        self.assertEqual(evento["state"], "Alerta Emitido")

    def test_entrada_invalida_400(self):
        csrf = self.login()
        for payload in ({"category": "INVALIDA"}, {"category": "AGUA", "severity": "abc"}, {"category": "AGUA", "lat": "x"}):
            self.assertEqual(self.client.post("/api/events", json=payload, headers={"X-CSRF-Token": csrf}).status_code, 400)

    def test_confirmacao_rn01_e_estado_final(self):
        csrf = self.login("mariana")
        evento = self._criar_relato(csrf)  # 35%, Em Validação
        res = self.client.post(f"/api/events/{evento['id']}/confirm", headers={"X-CSRF-Token": csrf}).get_json()
        self.assertEqual((res["confidence"], res["state"]), (50, "Alerta Emitido"))  # +15% atinge 50%
        sql("UPDATE risk_events SET state = 'Encerrado' WHERE id = ?;", (evento["id"],))
        self.assertEqual(self.client.post(f"/api/events/{evento['id']}/confirm", headers={"X-CSRF-Token": csrf}).status_code, 409)

    def test_simulacao_de_sensor_montada_no_servidor(self):
        csrf = self.login("mariana")
        res = self.client.post("/api/simulacoes/sensor", json={"baseWeight": 100, "title": "<script>"}, headers={"X-CSRF-Token": csrf})
        evento = res.get_json()["event"]
        self.assertEqual(res.status_code, 201)
        self.assertEqual((evento["sourceType"], evento["baseWeight"]), ("IOT_SENSOR", 80))
        self.assertIn("simulada", evento["sourceName"])
        self.assertEqual(evento["calculatedConfidence"], 95)  # convergência sensor + morador (RN01)

    def test_esquecimento_so_dos_proprios_dados(self):
        csrf = self.login("mariana")
        self.assertEqual(self.client.delete("/api/lgpd/forget/roberto", headers={"X-CSRF-Token": csrf}).status_code, 403)
        self.assertEqual(sql("SELECT COUNT(*) FROM users_lgpd_vault WHERE user_id = 'roberto';")[0][0], 1)
        self.assertEqual(self.client.delete("/api/lgpd/forget/mariana", headers={"X-CSRF-Token": csrf}).status_code, 200)

    def test_listagem_ordenada_por_score_rn02(self):
        self.login()
        scores = [e["calculatedRiskScore"] for e in self.client.get("/api/events").get_json()]
        self.assertEqual(scores, sorted(scores, reverse=True))


class TestSemSegredoDeSessao(Base):
    """A sessão não depende de SECRET_KEY: não há segredo fixo nem valor de reserva."""

    def test_secret_key_ausente_e_flask_session_recusado(self):
        self.assertIsNone(servidor.app.secret_key)
        from flask import session
        with servidor.app.test_request_context("/"):
            with self.assertRaises(RuntimeError):  # Flask não assina nada sem segredo
                session["x"] = 1

    def test_login_funciona_sem_segredo_e_sobrevive_a_novo_cliente(self):
        self.login()
        token = self.cookie().value
        outro = servidor.app.test_client()  # equivale a reiniciar: estado só no banco
        outro.set_cookie(servidor.SESSION_COOKIE, token)
        self.assertEqual(outro.get("/api/auth/session").status_code, 200)


class TestContasDemo(unittest.TestCase):
    """preparar-contas-demo em outro banco temporário (o banco dos demais testes e o real não são tocados)."""

    TABELAS_DADOS = ("risk_events", "monitored_zones", "users_lgpd_vault", "audit_logs")

    def setUp(self):
        self._db_anterior = servidor.DB_PATH
        servidor.DB_PATH = os.path.join(_TMP.name, f"demo-{secrets.token_hex(4)}.db")
        servidor.init_sql_database()
        servidor._falhas.clear()
        self.client = servidor.app.test_client()

    def tearDown(self):
        servidor.DB_PATH = self._db_anterior

    def dados(self):
        return {t: sql(f"SELECT * FROM {t} ORDER BY 1;") for t in self.TABELAS_DADOS}

    def entrar(self, conta, senha):
        return self.client.post("/api/auth/login", json={"identifier": conta, "password": senha})

    def test_cria_e_depois_redefine_sem_tocar_em_outros_dados(self):
        antes = self.dados()
        self.assertEqual(servidor.preparar_contas_demo(), {c: "criada" for c in servidor.CONTAS_TESTE})
        self.assertEqual(servidor.preparar_contas_demo(), {c: "redefinida" for c in servidor.CONTAS_TESTE})
        self.assertEqual(self.dados(), antes)

    def test_login_das_tres_contas_com_1234_e_perfis(self):
        servidor.preparar_contas_demo()
        esperado = {"mariana": ("morador", False), "roberto": ("defesa_civil", True), "lucas": ("cco", True)}
        for conta, (papel, agente) in esperado.items():
            res = self.entrar(conta, "1234")
            self.assertEqual(res.status_code, 200, conta)
            self.assertEqual((res.get_json()["user"]["papel"], res.get_json()["user"]["isAgent"]), (papel, agente))
            self.assertEqual(self.entrar(conta, "12345").status_code, 401)

    def test_senha_guardada_como_scrypt_e_nao_em_texto(self):
        servidor.preparar_contas_demo()
        for (h,) in sql("SELECT password_hash FROM auth_accounts;"):
            self.assertTrue(h.startswith("scrypt:"))
            self.assertNotIn("1234", h.split("$", 1)[0])

    def test_moradora_sem_moderacao_e_logout_bloqueia(self):
        servidor.preparar_contas_demo()
        csrf = self.entrar("mariana", "1234").get_json()["csrfToken"]
        res = self.client.patch("/api/events/EVT-2026-001/state", json={"state": "Em Monitoramento", "role": "cco"}, headers={"X-CSRF-Token": csrf})
        self.assertEqual(res.status_code, 403)
        self.client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
        self.assertEqual(self.client.get("/painel.html").status_code, 302)
        self.assertEqual(self.client.get("/api/events").status_code, 401)

    def test_reinicio_nao_redefine_senha(self):
        servidor.definir_senha_conta("mariana", "senha-propria-longa")
        hash_antes = sql("SELECT password_hash FROM auth_accounts WHERE user_id = 'mariana';")
        servidor.init_sql_database()  # o que python app.py faz ao iniciar
        self.assertEqual(sql("SELECT password_hash FROM auth_accounts WHERE user_id = 'mariana';"), hash_antes)
        self.assertEqual(self.entrar("mariana", "1234").status_code, 401)
        self.assertEqual(sql("SELECT COUNT(*) FROM auth_accounts;")[0][0], 1)  # nada criado sozinho

    def test_nao_recria_dados_do_cofre_excluidos(self):
        sql("DELETE FROM users_lgpd_vault WHERE user_id = 'mariana';")  # titular exerceu o esquecimento
        servidor.preparar_contas_demo()
        self.assertEqual(sql("SELECT COUNT(*) FROM users_lgpd_vault WHERE user_id = 'mariana';")[0][0], 0)

    def test_comando_exige_confirmacao(self):
        import builtins
        from unittest import mock
        with mock.patch.object(builtins, "input", return_value="nao"), mock.patch("builtins.print"):
            self.assertEqual(servidor.comando_preparar_contas_demo(), 1)
        self.assertEqual(sql("SELECT COUNT(*) FROM auth_accounts;")[0][0], 0)
        with mock.patch.object(builtins, "input", return_value="SIM"), mock.patch("builtins.print"):
            self.assertEqual(servidor.comando_preparar_contas_demo(), 0)
        self.assertEqual(sql("SELECT COUNT(*) FROM auth_accounts;")[0][0], 3)


class TestRegrasDeNegocio(unittest.TestCase):
    def test_rn01(self):
        self.assertEqual(servidor.calcular_nivel_confianca_rn01(35, False, 0, False, False), 35)
        self.assertEqual(servidor.calcular_nivel_confianca_rn01(35, True, 1, False, False), 65)
        self.assertEqual(servidor.calcular_nivel_confianca_rn01(35, False, 9, False, False), 80)  # bônus máx. +45
        self.assertEqual(servidor.calcular_nivel_confianca_rn01(35, False, 0, False, True), 95)
        self.assertEqual(servidor.calcular_nivel_confianca_rn01(85, True, 4, True, True), 100)

    def test_rn02(self):
        self.assertEqual(servidor.calcular_score_risco_rn02(4, 4, 100)["priorityCode"], "P1")
        self.assertEqual(servidor.calcular_score_risco_rn02(3, 3, 80)["score"], 60)
        self.assertEqual(servidor.calcular_score_risco_rn02(1, 1, 35)["priorityCode"], "P4")


if __name__ == "__main__":
    unittest.main()
