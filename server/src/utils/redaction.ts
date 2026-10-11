const SENSITIVE = /^(authorization|cookie|set-cookie|password|passwordHash|secret|.*Secret|.*Token|.*ApiKey|privateKey|mnemonic|seed|ciphertext|twoFactorCode|otp|confirmToken|cardNumber|pan|cvv|email|phoneNumber|toAddress|fromAddress)$/i;
export function redactLogValue(input: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 6) return '[depth limit]';
  if (typeof input === 'string') return input
    .replace(/(Bearer\s+)[^\s"']+/gi, '$1[redacted]')
    .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/gi, '$1[redacted]@')
    .replace(/([?&](?:api_?key|token|secret|password)=)[^&\s]+/gi, '$1[redacted]');
  if (!input || typeof input !== 'object') return input;
  if (seen.has(input)) return '[circular]'; seen.add(input);
  if (input instanceof Date) return input.toISOString();
  if (Array.isArray(input)) return input.slice(0, 100).map(x => redactLogValue(x, depth + 1, seen));
  const result: Record<string, unknown> = {};
  // Axios/HTTP error configs carry credentials and bodies: omit them entirely.
  for (const key of Object.getOwnPropertyNames(input).slice(0, 100)) {
    if (['config', 'request', 'response', 'headers', 'body'].includes(key) || SENSITIVE.test(key)) result[key] = '[redacted]';
    else result[key] = redactLogValue((input as Record<string, unknown>)[key], depth + 1, seen);
  }
  return result;
}
