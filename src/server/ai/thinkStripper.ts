/**
 * Strips Qwen3 <think>...</think> blocks from streamed output.
 * Shared by Local and Modal providers.
 */
export class ThinkStripper {
  private buffer = '';
  private decided = false;

  process(chunk: string): string {
    if (this.decided) return chunk;

    this.buffer += chunk;

    if (this.buffer.length > 10 && !this.buffer.startsWith('<think>')) {
      this.decided = true;
      const result = this.buffer;
      this.buffer = '';
      return result;
    }

    const closeIdx = this.buffer.indexOf('</think>');
    if (closeIdx !== -1) {
      this.decided = true;
      const afterThink = this.buffer.slice(closeIdx + '</think>'.length).trimStart();
      this.buffer = '';
      return afterThink;
    }

    if (this.buffer.length > 8000) {
      this.decided = true;
      const result = this.buffer;
      this.buffer = '';
      return result;
    }

    return '';
  }

  flush(): string {
    if (!this.decided) {
      const result = this.buffer;
      this.buffer = '';
      return result;
    }
    return '';
  }
}
