import PropTypes from 'prop-types';
import React from 'react';

import { DocumentTableHeaderCell } from '..';


export function DocumentTableHeader({ actions, columns }) {
  return (
    <thead>
      <tr className="documentTable__row documentTable__row--header">
        <DocumentTableHeaderCell />
        { columns.map((column) => (
          <DocumentTableHeaderCell
            actions={actions}
            column={column}
            key={column.property}
          />
        )) }
      </tr>
    </thead>
  );
}

DocumentTableHeader.propTypes = {
  actions: PropTypes.objectOf(PropTypes.func),
  columns: PropTypes.arrayOf(PropTypes.object),
};
