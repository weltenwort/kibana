import PropTypes from 'prop-types';
import React from 'react';

import {
  DocumentTableExpandCell,
  getCellComponent,
} from '..';

import './document_table_body_row.css';


export class DocumentTableBodyRow extends React.PureComponent {
  static propTypes = {
    actions: PropTypes.objectOf(PropTypes.func),
    columns: PropTypes.arrayOf(PropTypes.object),
    row: PropTypes.object,
  };

  render() {
    const { actions, columns, row } = this.props;

    return (
      <tr className="documentTable__row">
        <DocumentTableExpandCell
          actions={actions}
          row={row}
        />
        {columns.map((column) => {
          const Cell = getCellComponent(column.type);
          return (
            <Cell
              column={column}
              key={column.property}
              row={row}
            />
          );
        })}
      </tr>
    );
  }
}

