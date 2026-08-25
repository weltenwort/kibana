/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import dedent from 'dedent';
import { z } from '@kbn/zod/v4';
import { ToolType } from '@kbn/agent-builder-common';
import { ToolResultType } from '@kbn/agent-builder-common/tools/tool_result';
import type { BuiltinToolDefinition, StaticToolRegistration } from '@kbn/agent-builder-server';
import { OBSERVABILITY_SPIKE_COUNTER_ATTACHMENT_TYPE_ID } from '../../../common';
import type { SpikeCounterAttachmentData } from '../../attachments/spike_counter';
import { MAX_SHORT_STRING_LENGTH } from '../../utils/schema_limits';

export const OBSERVABILITY_SPIKE_COUNTER_TOOL_ID = 'observability.spike_counter';

const spikeCounterSchema = z.object({
  label: z
    .string()
    .max(MAX_SHORT_STRING_LENGTH)
    .optional()
    .describe('Optional label for the counter. Defaults to "Spike counter".'),
});

/**
 * Throwaway tool backing the attachment mutation spike (observability-dev#6064).
 * The model only supplies a label; the counter payload is produced server-side.
 */
export function createSpikeCounterTool(): StaticToolRegistration<typeof spikeCounterSchema> {
  const toolDefinition: BuiltinToolDefinition<typeof spikeCounterSchema> = {
    id: OBSERVABILITY_SPIKE_COUNTER_TOOL_ID,
    type: ToolType.builtin,
    annotations: {
      title: 'Spike Counter',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    description: dedent(`
      Creates a counter attachment starting at zero, used to test attachment mutation.

      **When to use:**
      - When the user asks for a spike counter, a test counter, or a counter attachment
    `),
    schema: spikeCounterSchema,
    tags: ['observability', 'spike'],
    handler: async (params, { attachments }) => {
      const data: SpikeCounterAttachmentData = {
        count: 0,
        label: params.label ?? 'Spike counter',
      };

      const added = await attachments.add({
        type: OBSERVABILITY_SPIKE_COUNTER_ATTACHMENT_TYPE_ID,
        data,
        description: `Spike counter: ${data.label}`,
      });

      return {
        results: [
          {
            type: ToolResultType.other,
            data: {
              ...data,
              attachment_ids: [added.id],
            },
          },
        ],
      };
    },
  };

  return toolDefinition;
}
