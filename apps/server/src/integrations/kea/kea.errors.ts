export class KeaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeaError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class KeaConnectionError extends KeaError {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'KeaConnectionError';
  }
}

export class KeaTimeoutError extends KeaError {
  constructor(message = 'Kea Control Agent connection timed out') {
    super(message);
    this.name = 'KeaTimeoutError';
  }
}

export class KeaCommandError extends KeaError {
  constructor(
    public readonly command: string,
    public readonly resultCode: number,
    message: string
  ) {
    super(message || `Kea command '${command}' returned error code ${resultCode}`);
    this.name = 'KeaCommandError';
  }
}

export class KeaParseError extends KeaError {
  constructor(message: string, public readonly rawContent?: string) {
    super(message);
    this.name = 'KeaParseError';
  }
}
