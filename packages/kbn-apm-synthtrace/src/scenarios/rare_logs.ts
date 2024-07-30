/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
import {
  infra,
  LogDocument,
  log,
  generateShortId,
  generateLongId,
} from '@kbn/apm-synthtrace-client';
import { fakerEN as faker } from '@faker-js/faker';
import { Scenario } from '../cli/scenario';
import { withClient } from '../lib/utils/with_client';
import { generateUnstructuredLogMessage } from './helpers/unstructured_logs';

const scenario: Scenario<LogDocument> = async (runOptions) => {
  return {
    generate: ({ range, clients: { logsEsClient, infraEsClient } }) => {
      const { logger } = runOptions;

      // Logs Data logic
      const LOG_LEVELS = ['info', 'debug', 'error', 'warn', 'trace', 'fatal'];

      const clusterDefinions = [
        {
          'orchestrator.cluster.id': generateShortId(),
          'orchestrator.cluster.name': 'synth-cluster-1',
          'orchestrator.namespace': 'default',
          'cloud.provider': 'gcp',
          'cloud.region': 'eu-central-1',
          'cloud.availability_zone': 'eu-central-1a',
          'cloud.project.id': generateShortId(),
        },
        {
          'orchestrator.cluster.id': generateShortId(),
          'orchestrator.cluster.name': 'synth-cluster-2',
          'orchestrator.namespace': 'production',
          'cloud.provider': 'aws',
          'cloud.region': 'us-east-1',
          'cloud.availability_zone': 'us-east-1a',
          'cloud.project.id': generateShortId(),
        },
        {
          'orchestrator.cluster.id': generateShortId(),
          'orchestrator.cluster.name': 'synth-cluster-3',
          'orchestrator.namespace': 'kube',
          'cloud.provider': 'azure',
          'cloud.region': 'area-51',
          'cloud.availability_zone': 'area-51a',
          'cloud.project.id': generateShortId(),
        },
      ];

      const hostDefinitions = [
        {
          'host.hostname': 'host-1',
          'host.name': 'host-1',
          'agent.id': 'synth-agent-1',
          'agent.name': 'nodejs',
          'cloud.instance.id': generateShortId(),
          'orchestrator.resource.id': generateShortId(),
          ...clusterDefinions[0],
        },
        {
          'host.hostname': 'host-2',
          'host.name': 'host-2',
          'agent.id': 'synth-agent-2',
          'agent.name': 'custom',
          'cloud.instance.id': generateShortId(),
          'orchestrator.resource.id': generateShortId(),
          ...clusterDefinions[1],
        },
        {
          'host.hostname': 'host-3',
          'host.name': 'host-3',
          'agent.id': 'synth-agent-3',
          'agent.name': 'python',
          'cloud.instance.id': generateShortId(),
          'orchestrator.resource.id': generateShortId(),
          ...clusterDefinions[2],
        },
      ];

      const serviceNames = Array(3)
        .fill(null)
        .map((_, idx) => `synth-service-${idx}`);

      const backgroundLogs = range
        .interval('1s')
        .rate(1)
        .generator((timestamp) => {
          const hostDefinition = faker.helpers.arrayElement(hostDefinitions);
          const serviceName = faker.helpers.arrayElement(serviceNames);
          const level = faker.helpers.arrayElement(LOG_LEVELS);
          const message = generateUnstructuredLogMessage(faker);

          return [
            log
              .create()
              .message(message.replace('<random>', generateShortId()))
              .logLevel(level)
              .service(serviceName)
              .hostName(hostDefinition['host.name'])
              .defaults({
                ...hostDefinition,
                'trace.id': generateShortId(),
                'container.name': `${serviceName}-${generateShortId()}`,
                'log.file.path': `/logs/${generateLongId()}/${serviceName}.log`,
              })
              .timestamp(timestamp),
          ];
        });

      const hosts = range
        .interval('30s')
        .rate(1)
        .generator((timestamp) =>
          hostDefinitions.flatMap((hostDefinition) => {
            const host = infra.minimalHost(hostDefinition['host.name'], hostDefinition);

            return [
              host.cpu().timestamp(timestamp),
              host.memory().timestamp(timestamp),
              host.network().timestamp(timestamp),
              host.load().timestamp(timestamp),
              host.filesystem().timestamp(timestamp),
              host.diskio().timestamp(timestamp),
            ];
          })
        );

      return [
        withClient(
          logsEsClient,
          logger.perf('generating_logs', () => [backgroundLogs])
        ),

        withClient(
          infraEsClient,
          logger.perf('generating_infra_hosts', () => hosts)
        ),
      ];
    },
  };
};

export default scenario;
