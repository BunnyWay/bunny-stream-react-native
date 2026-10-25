import { describe, expect, it } from '@jest/globals';

import { normalizePlayerErrorEvent } from '../internal/playerErrorEvent';

describe('normalizePlayerErrorEvent', () => {
  const legacy = { code: 'PLAYBACK_ERROR', message: 'failed', nativeCode: 'native' };

  it('preserves legacy fields without adding a classification', () => {
    expect(normalizePlayerErrorEvent(legacy)).toStrictEqual(legacy);
  });

  it.each([undefined, 0, -1, 99, 600, 403.5, NaN])('omits missing/invalid status %s', (httpStatus) => {
    const event = normalizePlayerErrorEvent({ ...legacy, httpStatus, category: 'unavailable' });
    expect(event).not.toHaveProperty('httpStatus');
    expect(event.category).toBe('unavailable');
  });

  it.each([100, 403, 404, 500, 599])('retains a real HTTP status %s', (httpStatus) => {
    expect(normalizePlayerErrorEvent({ ...legacy, httpStatus }).httpStatus).toBe(httpStatus);
  });

  it('maps an unrecognized native category to unknown', () => {
    expect(normalizePlayerErrorEvent({ ...legacy, category: 'future-category' }).category)
      .toBe('unknown');
  });

  it('omits the Fabric empty-string sentinel', () => {
    expect(normalizePlayerErrorEvent({ ...legacy, category: '' })).toStrictEqual(legacy);
  });
});
