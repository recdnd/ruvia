/* Pack Menu Kit: small-button list row builders */
(function (global) {
  function createRow(baseClass, isActive, labelText, onClick) {
    var row = document.createElement('div');
    row.className = baseClass + (isActive ? ' active' : '');

    var prefix = document.createElement('span');
    prefix.className = baseClass + '-prefix';
    prefix.textContent = '\u27A2';

    var nameEl = document.createElement('span');
    nameEl.className = baseClass + '-name';
    nameEl.textContent = labelText || '';

    row.addEventListener('click', onClick);
    row.appendChild(prefix);
    row.appendChild(nameEl);
    return row;
  }

  global.PackMenuKit = {
    createPackRow: function (opts) {
      return createRow('pack-item', !!opts.active, opts.label, opts.onClick);
    },
    createQuestionRow: function (opts) {
      return createRow('question-item', !!opts.active, opts.label, opts.onClick);
    }
  };
})(window);

