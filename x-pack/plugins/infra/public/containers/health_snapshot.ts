/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { failure } from 'io-ts/lib/PathReporter';
import { useState, useEffect } from 'react';

import {
  HealthCheck,
  healthSnapshotApiPath,
  healthSnapshotApiRequestPayloadType,
  healthSnapshotApiResponsePayloadType,
} from '../../common/http_api';

export const useHealthSnapshot = ({ sourceId, time }: { sourceId: string; time: number }) => {
  const [healthSnapshot, setHealthSnapshot] = useState<HealthCheck[]>([]);

  useEffect(
    () => {
      fetchHealthSnapshot(sourceId, time)
        .then(result =>
          healthSnapshotApiResponsePayloadType.decode(result.json()).getOrElseL(errors => {
            throw new Error(failure(errors).join('\n'));
          })
        )
        .then(decodedResult => setHealthSnapshot(decodedResult.data.healthSnapshot));
    },
    [sourceId, time]
  );

  return {
    isAllHealthy: healthSnapshot.every(healthCheck => healthCheck.health === 'healthy'),
  };
};

const fetchHealthSnapshot = (sourceId: string, time: number) =>
  fetch(healthSnapshotApiPath, {
    method: 'POST',
    body: JSON.stringify(
      healthSnapshotApiRequestPayloadType.encode({
        sourceId,
        time,
      })
    ),
  });
