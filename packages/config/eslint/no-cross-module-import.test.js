import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-cross-module-import.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const api = '/repo/apps/api/src';
const inAuctions = `${api}/modules/auctions/application/place-bid.ts`;

new RuleTester().run('no-cross-module-import', rule, {
  valid: [
    { filename: inAuctions, code: "import { Bid } from '../domain/bid.js';" },
    { filename: inAuctions, code: "import { createOrder } from '../../orders/index.js';" },
    { filename: inAuctions, code: "export * from '../../orders/index.js';" },
    {
      filename: `${api}/app.module.ts`,
      code: "import { AuctionsModule } from './modules/auctions/index.js';",
    },
    { filename: inAuctions, code: "import { Injectable } from '@nestjs/common';" },
    { filename: '/repo/apps/web/app/page.tsx', code: "import { Price } from '@arc/contracts';" },
  ],
  invalid: [
    {
      filename: inAuctions,
      code: "import { Order } from '../../orders/domain/order.js';",
      errors: [{ messageId: 'crossModule', data: { module: 'orders' } }],
    },
    {
      filename: inAuctions,
      code: "export { Order } from '../../orders/domain/order.js';",
      errors: [{ messageId: 'crossModule' }],
    },
    {
      filename: inAuctions,
      code: "const m = await import('../../ledger/infrastructure/repo.js');",
      languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
      errors: [{ messageId: 'crossModule', data: { module: 'ledger' } }],
    },
    {
      filename: `${api}/app.module.ts`,
      code: "import { BidService } from './modules/auctions/application/bid.service.js';",
      errors: [{ messageId: 'crossModule', data: { module: 'auctions' } }],
    },
    {
      filename: '/repo/apps/web/app/page.tsx',
      code: "import { Price } from '../../../packages/contracts/src/index.js';",
      errors: [{ messageId: 'crossPackage', data: { pkg: 'packages/contracts' } }],
    },
  ],
});
