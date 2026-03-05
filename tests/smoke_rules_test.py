import http.server
import os
import re
import socketserver
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = 8765
BASE = f"http://127.0.0.1:{PORT}"


class SilentHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        return


class SmokeRulesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._old_cwd = os.getcwd()
        os.chdir(ROOT)
        cls.httpd = socketserver.TCPServer(("127.0.0.1", PORT), SilentHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.2)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        os.chdir(cls._old_cwd)

    def fetch_text(self, path):
        with urllib.request.urlopen(f"{BASE}{path}", timeout=5) as response:
            return response.read().decode("utf-8")

    def test_admin_page_serves_and_has_new_controls(self):
        html = self.fetch_text("/admin.html")
        self.assertIn("Dar el control", html)
        self.assertIn("Expulsar todos los jugadores", html)
        self.assertIn("Puntuación para ganar", html)
        self.assertIn("Terminar Partida", html)
        self.assertIn("Sumar Puntos", html)

    def test_captain_page_removed(self):
        with self.assertRaises(urllib.error.HTTPError) as context:
            self.fetch_text("/captain.html")
        self.assertEqual(context.exception.code, 404)

    def test_state_rules_present(self):
        state_js = (ROOT / "js" / "state.js").read_text(encoding="utf-8")
        self.assertIn("WINNING_SCORE_OPTIONS = [250, 500, 750, 1000]", state_js)
        self.assertIn('case "SET_WINNING_SCORE"', state_js)
        self.assertIn('case "DECLARE_WINNER"', state_js)
        self.assertRegex(state_js, r"Math\.min\(3,\s*Math\.max\(0,")

    def test_admin_round_actions_reset_round(self):
        admin_js = (ROOT / "js" / "admin.js").read_text(encoding="utf-8")
        self.assertIn('await dispatch("ADD_SCORE"', admin_js)
        self.assertIn('await dispatch("SET_QUESTION_INDEX", { index: -1 })', admin_js)
        self.assertIn("isLastQuestionInRound", admin_js)

    def test_disabled_color_is_consistent(self):
        css = (ROOT / "styles.css").read_text(encoding="utf-8")
        self.assertIn("button:disabled", css)
        self.assertIn("background: rgba(90, 90, 90, 0.35);", css)
        self.assertNotIn("toggleButton.textContent = \"Bloqueado\"", (ROOT / "js" / "admin.js").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
