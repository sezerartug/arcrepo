import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AuctionSnapshot } from '@/lib/types';
import { AuctionPanel } from './auction-panel';

const snap = (myState: AuctionSnapshot['myState']): AuctionSnapshot => ({
  id: 'a1',
  listingId: 'l1',
  status: 'LIVE',
  startPriceMinor: '75000',
  currentPriceMinor: '75000',
  minNextBidMinor: '76000',
  bidCount: 1,
  endsAt: '2026-10-31T17:12:00.000Z',
  serverNow: '2026-10-30T10:00:00.000Z',
  depositMinor: '3750000',
  startsAt: '2026-10-29T12:08:00.000Z',
  bids: [],
  myState,
});

describe('AuctionPanel bid gate message', () => {
  it('tells the seller they cannot bid on their own auction (not "company must be verified")', () => {
    const html = renderToStaticMarkup(
      <AuctionPanel
        initial={snap({
          eligible: false,
          depositStatus: 'none',
          isHighBidder: false,
          isSeller: true,
        })}
        loggedIn
        canBid={false}
      />,
    );
    expect(html).toContain('Kendi mezatınıza teklif veremezsiniz');
    expect(html).not.toContain('şirketinizin onaylı olması');
  });

  it('keeps the verification message for other buyers who cannot bid', () => {
    const html = renderToStaticMarkup(
      <AuctionPanel
        initial={snap({
          eligible: false,
          depositStatus: 'none',
          isHighBidder: false,
          isSeller: false,
        })}
        loggedIn
        canBid={false}
      />,
    );
    expect(html).toContain('şirketinizin onaylı olması');
  });
});
