/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { PoissonEvents } from './random_events';
import { Serializable } from './serializable';

describe('poisson events', () => {
  it('generates events within the given time range', () => {
    const poissonEvents = new PoissonEvents(new Date(1000), new Date(2000), 10);

    const events = Array.from(
      poissonEvents.generator((timestamp) => new Serializable({ '@timestamp': timestamp }))
    );

    expect(events.length).toBeGreaterThanOrEqual(1);

    for (const event of events) {
      expect(event.fields['@timestamp']).toBeGreaterThanOrEqual(1000);
      expect(event.fields['@timestamp']).toBeLessThanOrEqual(2000);
    }
  });

  it('generates at least one event if the rate is greater than 0', () => {
    const poissonEvents = new PoissonEvents(new Date(1000), new Date(2000), 1);

    const events = Array.from(
      poissonEvents.generator((timestamp) => new Serializable({ '@timestamp': timestamp }))
    );

    expect(events.length).toBeGreaterThanOrEqual(1);

    for (const event of events) {
      expect(event.fields['@timestamp']).toBeGreaterThanOrEqual(1000);
      expect(event.fields['@timestamp']).toBeLessThanOrEqual(2000);
    }
  });

  it('generates no event if the rate is 0', () => {
    const poissonEvents = new PoissonEvents(new Date(1000), new Date(2000), 0);

    const events = Array.from(
      poissonEvents.generator((timestamp) => new Serializable({ '@timestamp': timestamp }))
    );

    expect(events.length).toBe(0);
  });
});
