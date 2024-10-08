/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  InlineRoleTemplate,
  InvalidRoleTemplate,
  RoleTemplate,
  StoredRoleTemplate,
} from '../../../../../common';

export function isStoredRoleTemplate(
  roleMappingTemplate: RoleTemplate
): roleMappingTemplate is StoredRoleTemplate {
  return (
    roleMappingTemplate.template != null &&
    typeof roleMappingTemplate.template === 'object' &&
    Object.hasOwn(roleMappingTemplate.template, 'id') &&
    typeof (roleMappingTemplate as unknown as StoredRoleTemplate).template.id === 'string'
  );
}

export function isInlineRoleTemplate(
  roleMappingTemplate: RoleTemplate
): roleMappingTemplate is InlineRoleTemplate {
  return (
    roleMappingTemplate.template != null &&
    typeof roleMappingTemplate.template === 'object' &&
    Object.hasOwn(roleMappingTemplate.template, 'source') &&
    typeof (roleMappingTemplate as unknown as InlineRoleTemplate).template.source === 'string'
  );
}

export function isInvalidRoleTemplate(
  roleMappingTemplate: RoleTemplate
): roleMappingTemplate is InvalidRoleTemplate {
  return !isStoredRoleTemplate(roleMappingTemplate) && !isInlineRoleTemplate(roleMappingTemplate);
}
