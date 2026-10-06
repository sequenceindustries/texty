"""A stand-in for the Anthropic Messages API, for browser tests of the AI rewriter."""
import json, sys, time
from http.server import BaseHTTPRequestHandler, HTTPServer

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['content-length'])))
        prompt = body['messages'][0]['content']
        if 'SLOW' in prompt:
            time.sleep(5)
        text = '<rewrite>\nThis is a clearer, more confident version of your text.\n'
        out = json.dumps({'content': [{'type': 'text', 'text': text}], 'stop_reason': 'stop_sequence', 'usage': {'input_tokens': 50, 'output_tokens': 20}}).encode()
        self.send_response(200)
        self.send_header('content-type', 'application/json')
        self.send_header('content-length', str(len(out)))
        self.end_headers()
        self.wfile.write(out)

HTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
