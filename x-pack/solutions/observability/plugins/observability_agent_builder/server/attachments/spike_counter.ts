/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import type { AttachmentTypeDefinition } from '@kbn/agent-builder-server/attachments';
import { OBSERVABILITY_SPIKE_COUNTER_ATTACHMENT_TYPE_ID } from '../../common';
import { MAX_SHORT_STRING_LENGTH } from '../utils/schema_limits';
import { observabilityAttachmentDataSchema } from './observability_attachment_data_schema';

const spikeCounterDataSchema = observabilityAttachmentDataSchema.extend({
  count: z.number().int().min(0),
  label: z.string().max(MAX_SHORT_STRING_LENGTH),
});

export type SpikeCounterAttachmentData = z.infer<typeof spikeCounterDataSchema>;

/**
 * Throwaway attachment type used to measure whether client-side content mutations
 * re-render inline without an agent turn (observability-dev#6064). Not for production.
 */
export function createSpikeCounterAttachmentType(): AttachmentTypeDefinition<
  typeof OBSERVABILITY_SPIKE_COUNTER_ATTACHMENT_TYPE_ID,
  SpikeCounterAttachmentData
> {
  return {
    id: OBSERVABILITY_SPIKE_COUNTER_ATTACHMENT_TYPE_ID,
    validate: (input) => {
      const parsed = spikeCounterDataSchema.safeParse(input);
      if (parsed.success) {
        return { valid: true, data: parsed.data };
      }
      return { valid: false, error: parsed.error.message };
    },
    format: (attachment) => {
      const { count, label } = attachment.data;

      return {
        getRepresentation: () => ({
          type: 'text',
          value: `Spike counter "${label}" is currently at ${count}.`,
        }),
      };
    },
  };
}
