import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import './document_table_cell.css';


export function DocumentTableHeaderCell({
  actions,
  column,
  className,
}) {
  const classes = classNames('documentTable__cell', 'documentTable__cell--header', className);

  if (column) {
    return (
      <th className={classes}>
        <span>{ column.label }</span>
        { column.isRemovable
          ? (
            <button
              className="kuiMicroButton"
              onClick={() => actions.removeColumn(column.property)}
              title="Remove Column"
            >
              <span className="kuiIcon fa-remove" />
            </button>
          )
          : null
        }
        { column.isMovable && !column.isFirst
          ? (
            <button
              className="kuiMicroButton"
              onClick={() => actions.moveColumn(column.property, column.index - 1)}
              title="Move Column left"
            >
              <span className="kuiIcon fa-angle-double-left" />
            </button>
          )
          : null
        }
        { column.isMovable && !column.isLast
          ? (
            <button
              className="kuiMicroButton"
              onClick={() => actions.moveColumn(column.property, column.index + 1)}
              title="Move Column right"
            >
              <span className="kuiIcon fa-angle-double-right" />
            </button>
          )
          : null
        }
      </th>
    );
  } else {
    return (
      <td className={classes} />
    );
  }
}

DocumentTableHeaderCell.propTypes = {
  actions: PropTypes.objectOf(PropTypes.func),
  column: PropTypes.object,
  className: PropTypes.string,
};
