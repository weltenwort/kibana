/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
import datemath from '@kbn/datemath';
import type { Moment } from 'moment';
import { Interval } from './interval';
import { PoissonEvents } from './random_events';

export class Timerange {
  constructor(private from: Date, private to: Date) {}

  interval(interval: string) {
    return new Interval({ from: this.from, to: this.to, interval });
  }

  ratePerMinute(rate: number) {
    return this.interval(`1m`).rate(rate);
  }

  poissonEvents(rate: number) {
    return new PoissonEvents(this.from, this.to, rate);
  }

  splitInto(segmentCount: number): Timerange[] {
    const duration = this.to.getTime() - this.from.getTime();
    const segmentDuration = duration / segmentCount;

    return Array.from({ length: segmentCount }, (_, i) => {
      const from = new Date(this.from.getTime() + i * segmentDuration);
      const to = new Date(from.getTime() + segmentDuration);
      return new Timerange(from, to);
    });
  }

  toString() {
    return `Timerange(from=${this.from.toISOString()}, to=${this.to.toISOString()})`;
  }
}

type DateLike = Date | number | Moment | string;

function getDateFrom(date: DateLike, now: Date): Date {
  if (date instanceof Date) return date;

  if (typeof date === 'string') {
    const parsed = datemath.parse(date, { forceNow: now });
    if (parsed && parsed.isValid()) {
      return parsed.toDate();
    }
  }

  if (typeof date === 'number' || typeof date === 'string') return new Date(date);

  return date.toDate();
}

export function timerange(from: DateLike, to: DateLike) {
  const now = new Date();
  return new Timerange(getDateFrom(from, now), getDateFrom(to, now));
}
