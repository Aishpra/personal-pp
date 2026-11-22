const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

// A fake Ollama that streams a reply in pieces, like the real one does with stream: true.
test('chat replies are streamed and joined back into one message', async () => {
  let sawStream;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      sawStream = JSON.parse(body).stream;
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      res.write('{"message":{"role":"assistant","content":"{\\"a\\":"},"done":false}\n{"message":{"role":"assistant","content":"1"');
      setTimeout(() => res.end('},"done":false}\n{"message":{"role":"assistant","content":"}"},"done":true,"eval_count":3}\n'), 20);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.OLLAMA_URL = `http://127.0.0.1:${server.address().port}`;
  const { ollama } = require('../src/copywriter');
  try {
    const res = await ollama('/api/chat', { model: 'x', messages: [], stream: false });
    assert.strictEqual(sawStream, true);
    assert.strictEqual(res.message.content, '{"a":1}');
    assert.strictEqual(res.done, true);
  } finally {
    server.close();
  }
});

test('a refused connection says Ollama is not running', async () => {
  process.env.OLLAMA_URL = 'http://127.0.0.1:9';
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/copywriter')];
  const { ollama } = require('../src/copywriter');
  await assert.rejects(ollama('/api/chat', { stream: false }), /isn't running/);
});
