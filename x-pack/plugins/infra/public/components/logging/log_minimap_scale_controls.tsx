/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { EuiButtonGroup, EuiFormRow } from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n/react';
import React, { useCallback, useMemo } from 'react';

interface IntervalSizeDescriptor {
  label: string;
  intervalSize: number;
}

interface LogMinimapScaleControlsProps {
  availableIntervalSizes: IntervalSizeDescriptor[];
  intervalSize: number;
  setIntervalSize: (intervalSize: number) => any;
}

export const LogMinimapScaleControls: React.FunctionComponent<LogMinimapScaleControlsProps> = ({
  availableIntervalSizes,
  intervalSize,
  setIntervalSize,
}) => {
  const changeMinimapScale = useCallback(
    (intervalSizeDescriptorKey: string) => {
      const [sizeDescriptor] = availableIntervalSizes.filter(
        intervalKeyEquals(intervalSizeDescriptorKey)
      );

      if (sizeDescriptor) {
        setIntervalSize(sizeDescriptor.intervalSize);
      }
    },
    [availableIntervalSizes, setIntervalSize]
  );

  const [currentSizeDescriptor] = useMemo(
    () => availableIntervalSizes.filter(intervalSizeEquals(intervalSize)),
    [availableIntervalSizes, intervalSize]
  );
  const buttons = useMemo(
    () =>
      availableIntervalSizes.map(sizeDescriptor => ({
        id: getIntervalSizeDescriptorKey(sizeDescriptor),
        label: sizeDescriptor.label,
      })),
    [availableIntervalSizes]
  );

  return (
    <EuiFormRow
      fullWidth
      label={
        <FormattedMessage
          id="xpack.infra.logs.customizeLogs.minimapScaleFormRowLabel"
          defaultMessage="Minimap Scale"
        />
      }
    >
      <EuiButtonGroup
        idSelected={getIntervalSizeDescriptorKey(currentSizeDescriptor)}
        options={buttons}
        onChange={changeMinimapScale}
      />
    </EuiFormRow>
  );
};

const getIntervalSizeDescriptorKey = (sizeDescriptor: IntervalSizeDescriptor) =>
  `${sizeDescriptor.intervalSize}`;

const intervalKeyEquals = (key: string) => (sizeDescriptor: IntervalSizeDescriptor) =>
  getIntervalSizeDescriptorKey(sizeDescriptor) === key;

const intervalSizeEquals = (size: number) => (sizeDescriptor: IntervalSizeDescriptor) =>
  sizeDescriptor.intervalSize === size;
