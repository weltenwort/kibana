/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { EuiFormRow, EuiButtonGroup } from '@elastic/eui';
import { FormattedMessage, injectI18n, InjectedIntl } from '@kbn/i18n/react';
import React, { useCallback, useMemo } from 'react';

import { isTextScale, TextScale } from '../../../common/log_text_scale';

interface LogTextScaleControlsProps {
  availableTextScales: TextScale[];
  intl: InjectedIntl;
  setTextScale: (scale: TextScale) => any;
  textScale: TextScale;
}

export const LogTextScaleControls = injectI18n(
  ({ availableTextScales, intl, setTextScale, textScale }: LogTextScaleControlsProps) => {
    const changeTextScale = useCallback(
      (newTextScale: string) => {
        if (isTextScale(newTextScale)) {
          setTextScale(newTextScale);
        }
      },
      [setTextScale]
    );

    const buttons = useMemo(
      () =>
        availableTextScales.map((availableTextScale: TextScale) => ({
          id: availableTextScale.toString(),
          label: intl.formatMessage(
            {
              id: 'xpack.infra.logs.customizeLogs.textSizeRadioGroup',
              defaultMessage:
                '{textScale, select, small {Small} medium {Medium} large {Large} other {{textScale}}}',
            },
            {
              textScale: availableTextScale,
            }
          ),
        })),
      [availableTextScales, intl]
    );

    return (
      <EuiFormRow
        label={
          <FormattedMessage
            id="xpack.infra.logs.customizeLogs.textSizeFormRowLabel"
            defaultMessage="Text Size"
          />
        }
      >
        <EuiButtonGroup onChange={changeTextScale} options={buttons} idSelected={textScale} />
      </EuiFormRow>
    );
  }
);
