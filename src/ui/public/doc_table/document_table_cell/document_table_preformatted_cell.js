import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import { DocumentTableDataCell } from './document_table_data_cell';


// export class DocumentTablePreformattedCell extends React.Component {
//   shouldComponentUpdate(nextProps) {
//     console.log('SU', this.props, nextProps);
//     return true;
//   }

//   render() {
//     const { className, column, row } = this.props;
//     const classes = classNames('documentTable__cell--withWordBreak', className);

//     return (
//       <DocumentTableDataCell
//         className={classes}
//         column={column}
//         row={row}
//       />
//     );
//   }
// }

export function DocumentTablePreformattedCell({
  className,
  column,
  row,
}) {
  const classes = classNames('documentTable__cell--withWordBreak', className);

  return (
    <DocumentTableDataCell
      className={classes}
      column={column}
      row={row}
    />
  );
}

DocumentTablePreformattedCell.propTypes = {
  className: PropTypes.string,
  column: PropTypes.object,
  row: PropTypes.object,
};
