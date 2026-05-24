import { Args, Command, Flags } from '@oclif/core';
import {
  collectJcliVars,
  debugFlag,
  formatDebugSection,
  formatDebugVarsHuman,
} from '../lib/debug/index.js';

export const formatGreeting = (name: string, uppercase: boolean): string => {
  const greeting = `Hello, ${name}! Welcome to Jahia CLI.`;
  return uppercase ? greeting.toUpperCase() : greeting;
};

export default class Hello extends Command {
  static override args = {
    name: Args.string({
      description: 'Name to greet',
      required: false,
      default: 'world',
    }),
  };

  static override description = 'Say hello from Jahia CLI';

  static override examples = [
    '<%= config.bin %> hello',
    '<%= config.bin %> hello friend',
    '<%= config.bin %> hello --uppercase',
  ];

  static override flags = {
    uppercase: Flags.boolean({
      char: 'u',
      description: 'Transform the greeting to uppercase',
      default: false,
    }),
    debug: debugFlag,
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Hello);
    if (flags.debug) {
      const debugEntries = collectJcliVars(process.env);
      this.log(formatDebugSection(formatDebugVarsHuman(debugEntries)));
    }
    const message = formatGreeting(args.name, flags.uppercase);
    this.log(message);
  }
}
