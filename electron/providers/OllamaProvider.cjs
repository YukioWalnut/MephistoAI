const AIProvider = require('./AIProvider.cjs');

class OllamaProvider extends AIProvider {
  constructor({
    url = 'http://127.0.0.1:11434',
    model = 'qwen2.5:7b',
    timeoutMs = 1200000,
  } = {}) {
    super();
    this.url = String(url).replace(/\/+$/, '');
    this.model = model || 'qwen2.5:7b';
    this.timeoutMs = Math.max(30000, Number(timeoutMs) || 600000);
  }

  async generate(messages, options = {}) {
    let response;
    try {
      response = await fetch(`${this.url}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          model: this.model,
          stream: false,
          keep_alive: '5m',
          messages,
          options: {
            temperature: 0.82,
            repeat_penalty: 1.12,
            // Keep the working context bounded for local 7B models.
            num_ctx: 8192,
            num_predict: 512,
            ...options,
          },
        }),
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new Error(`Ollama generation timed out after ${Math.round(this.timeoutMs / 1000)} seconds. The model is installed, but this computer may need more time to generate a response.`);
      }
      throw new Error(`Could not reach Ollama at ${this.url}: ${error.message}`);
    }

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Ollama returned an empty response. Check that the selected model supports chat.');
    }
    return content;
  }

  async models() {
    const response = await fetch(`${this.url}/api/tags`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Cannot connect to Ollama');
    return (await response.json()).models?.map(model => model.name) || [];
  }
}

module.exports = OllamaProvider;
