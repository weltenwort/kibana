/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { failure } from 'io-ts/lib/PathReporter';

import { InternalCoreSetup } from 'src/core/server';
import {
  HealthCheck,
  healthSnapshotApiPath,
  healthSnapshotApiRequestPayloadType,
  healthSnapshotApiResponsePayloadType,
} from '../../common/http_api';

export const registerRoutes = (core: InternalCoreSetup) => {
  const { server } = core.http;

  server.route({
    path: healthSnapshotApiPath,
    method: 'POST',
    async handler(request, response) {
      const payload = healthSnapshotApiRequestPayloadType
        .decode(request.payload)
        .getOrElseL(errors => {
          throw new Error(failure(errors).join('\n'));
        });

      const result = await getHealthSnapshot(payload.sourceId, payload.time);

      return response.response(
        healthSnapshotApiResponsePayloadType.encode({
          params: payload,
          data: {
            healthSnapshot: result,
          },
        })
      );
    },
  });
};

const getHealthSnapshot = async (sourceId: string, time: number): Promise<HealthCheck[]> =>
  sourceId === 'default'
    ? [
        {
          id: 'check1',
          health: 'healthy',
          time,
        },
        {
          id: 'check2',
          health: 'unhealthy',
          time,
        },
      ]
    : [];
