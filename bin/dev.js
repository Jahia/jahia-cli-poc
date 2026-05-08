#!/usr/bin/env -S npx tsx

import { execute } from '@oclif/core';

// Use development mode for dev plugins/ts-node, but disable debug
// to suppress stack traces in error output
process.env.NODE_ENV = 'development';

await execute({ dir: import.meta.url });
