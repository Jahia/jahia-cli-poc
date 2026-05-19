import { connect } from 'node:net';

/**
 * Waits for a TCP port on localhost to accept connections.
 * Used to ensure VictoriaLogs syslog listener is ready before starting
 * containers that use the syslog log driver.
 */
export const waitForPort = (port: number, timeoutMs: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = (): void => {
      const socket = connect({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for port ${String(port)} to accept connections`));
          return;
        }
        setTimeout(attempt, 200);
      });
    };
    attempt();
  });
