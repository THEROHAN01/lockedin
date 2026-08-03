import type { AiProvider } from './provider';

/**
 * The provider every test asserts against, so no test ever reaches the
 * Gateway. Records every prompt it was called with, and can be told to
 * reject — `generateText` returns a promise that can fail, and any future
 * call site is required to fall back rather than let that reach a user, so
 * the fake has to be able to exercise that path.
 */
export class FakeAiProvider implements AiProvider {
  readonly prompts: string[] = [];

  private readonly response: string | ((prompt: string) => string);
  private readonly shouldFail: boolean;

  constructor(
    options: {
      response?: string | ((prompt: string) => string);
      shouldFail?: boolean;
    } = {},
  ) {
    this.response = options.response ?? 'A fake motivational quote.';
    this.shouldFail = options.shouldFail ?? false;
  }

  generateText(prompt: string): Promise<string> {
    this.prompts.push(prompt);

    if (this.shouldFail) {
      return Promise.reject(new Error('FakeAiProvider was told to fail'));
    }

    const text =
      typeof this.response === 'function' ? this.response(prompt) : this.response;
    return Promise.resolve(text);
  }
}
