import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import './document_table.css';


// export function DocumentTable({
//   className,
//   documents = [],
//   headerElement,
//   rowElements = [],
// }) {
//   const classes = classNames('documentTable', className);

//   return (
//     <table className={classes}>
//       <thead>
//         { headerElement
//           ? React.cloneElement(headerElement)
//           : null
//         }
//       </thead>
//       <tbody>
//         { rowElements
//           ? documents.map((document) => (
//               rowElements.map((rowElement) => (
//                 React.cloneElement(rowElement, {
//                   document,
//                   key: createKey(document),
//                 })
//               ))
//             ))
//           : null
//         }
//       </tbody>
//     </table>
//   );
// }

// DocumentTable.propTypes = {
//   className: PropTypes.string,
//   documents: PropTypes.arrayOf(PropTypes.object),
//   headerElement: PropTypes.element,
//   rowElements: PropTypes.arrayOf(PropTypes.element),
// };

// function createKey(document) {
//   return `${document._type}#${document._id}`;
// }

export function DocumentTable({ children, className }) {
  const classes = classNames('documentTable', className);

  return (
    <table className={classes}>
      {children}
    </table>
  );
}

DocumentTable.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};
