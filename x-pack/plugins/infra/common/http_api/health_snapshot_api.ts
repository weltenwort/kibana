/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import * as runtimeTypes from 'io-ts';

export const healthSnapshotApiPath = '/api/infra/health-snapshot';

export const healthSnapshotApiRequestPayloadType = runtimeTypes.type({
  sourceId: runtimeTypes.string,
  time: runtimeTypes.number,
});

export const healthStatusType = runtimeTypes.keyof({
  healthy: null,
  unhealthy: null,
});

export const healthCheckType = runtimeTypes.type({
  id: runtimeTypes.string,
  health: healthStatusType,
  time: runtimeTypes.number,
});

export type HealthCheck = runtimeTypes.TypeOf<typeof healthCheckType>;

// export interface HealthCheck {
//   id: string;
//   health: 'healthy' | 'unhealthy';
//   time: number;
// }

export const healthSnapshotApiResponsePayloadType = runtimeTypes.type({
  params: healthSnapshotApiRequestPayloadType,
  data: runtimeTypes.type({
    healthSnapshot: runtimeTypes.array(healthCheckType),
  }),
});
