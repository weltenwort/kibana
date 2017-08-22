import _ from 'lodash';

import { DocumentTablePreformattedCell } from './document_table_preformatted_cell';
import { DocumentTableTimeCell } from './document_table_time_cell';


const cellComponents = {
  date: DocumentTableTimeCell,
};

export function getCellComponent(fieldType) {
  return _.get(cellComponents, fieldType, DocumentTablePreformattedCell);
}
