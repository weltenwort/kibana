/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { useEffect, useRef } from 'react';

export function usePrevious<Value>(value: Value): Value | undefined;
export function usePrevious<Value>(value: Value, initialValue: Value): Value;
export function usePrevious<Value>(value: Value, initialValue?: Value): Value | undefined {
  const ref = useRef<Value | undefined>(initialValue);

  useEffect(
    () => {
      ref.current = value;
    },
    [value]
  );

  return ref.current;
}
