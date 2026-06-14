/**
 * TxtLlmHub — Rendering Layer
 * DOM rendering of the preview list and comparison table,
 * search UI updates, and checkbox/sort state management.
 * Depends on: utils.js, state.js
 */
// ── File Filter Helper ──
function getCheckedFileNames() {
  return state.files.filter(function (f) { return f.checked; }).map(function (f) { return f.name; });
}


// ── Search UI ──
function updateSearchUI(wrapId, countId, q) {
  var wrap = $(wrapId);
  var countEl = $(countId);
  if (q) {
    wrap.classList.add('active');
  } else {
    wrap.classList.remove('active');
    countEl.textContent = '';
  }
}

// ── Preview Pane ──
function renderPreview() {
  var q = state.previewQuery;
  setHighlight(q);
  var checkedFiles = getCheckedFileNames();
  var filtered = state.lines.filter(function (l) {
    return !l._file || checkedFiles.indexOf(l._file) >= 0;
  });
  var lines = filtered.slice();
  var limit = state.previewRowLimit || 2000;
  if (limit > 0 && lines.length > limit) {
    lines = lines.slice(0, limit);
  }
  var shown = 0;
  if (q) {
    lines = lines.filter(function (l) {
      return matches(l.original, q) || matches(l.translation, q) || matches(l.new_translation, q);
    });
  }
  shown = lines.length;
  if (state.lines.length === 0) {
    $('cardPreview').innerHTML = '<div class="empty-state">请先上传 txt 文件</div>';
  } else if (q && shown === 0) {
    $('cardPreview').innerHTML = '<div class="empty-state">无匹配结果</div>';
  } else {
    var previewHtml = '<div class="line-list">';
    lines.forEach(function (l) {
      previewHtml += '<div class="line-item">' +
        '<span class="line-num">' + (l.index + 1) + '</span>' +
        '<span class="line-text">' +
          '<span class="orig">' + hl(l.original) + '</span>' +
          (l.translation ? '<span class="sep">=</span><span class="tran">' + hl(l.translation) + '</span>' : '') +
          (l.new_translation ? '<span class="sep">\u2192</span><span style="color:var(--green)">' + hl(l.new_translation) + '</span>' : '') +
        '</span>' +
        '<span class="line-actions">' +
          '<button class="btn" onclick="deletePreviewLine(' + l.index + ', event)" title="删除此条目">🗑</button>' +
          '<button class="btn" onclick="translateOne(' + l.index + ', event)" ' + (state.translating ? 'disabled' : '') + '>译</button>' +
        '</span>' +
        '<span class="line-check-wrap">' +
          '<input type="checkbox" class="preview-check" data-index="' + l.index + '" onclick="onPreviewCheck(this)" ' + (state.previewChecked.has(l.index) ? 'checked' : '') + '>' +
        '</span>' +
      '</div>';
    });
    previewHtml += '</div>';
    $('cardPreview').innerHTML = previewHtml;
  }
  $('previewSearchCount').textContent = q
    ? shown + ' 条匹配'
    : filtered.length + ' 行';
  updatePreviewSelectAllVisibility();
  updateSelectAllPreview();
}

// ── Compare Pane ──
function toggleSort() {
  state.sortState = (state.sortState + 1) % 3;
  var labels = ['\u25BC', '\u25BCO', '\u25BCN'];
  var titles = ['按原文排序', '按新译文排序', '恢复原始顺序'];
  var btn = $('btnSort');
  if (btn) { btn.textContent = labels[state.sortState]; btn.title = titles[state.sortState]; }
  renderCompare();
}

function renderCompare() {
  var q = state.compareQuery;
  setHighlight(q);
  var rows = state.lines.filter(function (l) { return l.new_translation || l.error; });
  var shown = rows.length;
  if (q) {
    rows = rows.filter(function (l) {
      return matches(l.original, q) || matches(l.translation, q) || matches(l.new_translation, q) || matches(l.error, q);
    });
    shown = rows.length;
  }
  if (state.lines.every(function (l) { return !l.new_translation && !l.error; })) {
    $('cardCompare').innerHTML = '<div class="empty-state">翻译后将在此显示前后对比</div>';
  } else if (q && shown === 0) {
    $('cardCompare').innerHTML = '<div class="empty-state">无匹配结果</div>';
  } else {
    var curSort = state.sortState;
    if (curSort === 1) {
      rows.sort(function (a, b) { return naturalCompare(a.original, b.original); });
    } else if (curSort === 2) {
      rows.sort(function (a, b) { return naturalCompare(a.new_translation || '', b.new_translation || ''); });
    }
    var compareHtml = '<table class="compare-table"><thead><tr>' +
      '<th class="col-check"><input type="checkbox" id="selectAllCompare" onclick="toggleSelectAllCompare()" title="全选/取消筛选结果"></th>' +
      '<th class="col-orig">原文</th>' +
      '<th class="col-old">旧译文</th>' +
      '<th class="col-new">新译文 <button class="btn btn-sm" onclick="clearNewWithoutOld()" title="清空所有无旧译文词条的新译文" style="font-size:0.68rem;padding:1px 6px">清</button></th>' +
      '<th class="col-actions"></th>' +
    '</tr></thead><tbody>';
    rows.forEach(function (l) {
      var rowCls = (l.error ? 'row-error' : '') + (l.keepOld ? ' row-keep' : '');
      compareHtml += '<tr class="' + rowCls + '">' +
        '<td class="col-check"><input type="checkbox" class="row-check" data-index="' + l.index + '" onclick="onCompareCheck(this)" ' + (state.compareChecked.has(l.index) ? 'checked' : '') + '></td>' +
        '<td class="cell-copyable" onclick="copyOriginal(event)" title="点击复制">' + hl(l.original) + '</td>' +
        '<td>' + (l.translation ? hl(l.translation) : '\u2014') + '</td>' +
        '<td class="cell-editable" onclick="editTranslation(' + l.index + ',event)" title="' + (l.warning ? l.warning : '点击编辑') + '">' +
          (l.error ? '\u26A0' + escHtml(l.error) : l.new_translation === ' ' ? '<span class="cleared-mark">\u2014</span>' : hl(l.new_translation)) +
          (l.truncated ? ' <span title="响应被截断，翻译可能不完整" style="cursor:help">\u26A0\uFE0F</span>' : '') +
          (l.warning && !l.truncated ? ' <span title="' + escHtml(l.warning) + '" style="cursor:help;color:var(--yellow)">\u26A0\uFE0F</span>' : '') +
        '</td>' +
        '<td class="col-actions">' +
          '<button class="btn btn-sm" onclick="keepOld(' + l.index + ')" ' + (l.keepOld || !l.translation ? 'disabled' : '') + ' title="' + (!l.translation ? '无原译文可保留' : '') + '">保留译文</button>' +
          '<button class="btn btn-sm" onclick="retryOne(' + l.index + ', event)">重译</button>' +
          '<button class="btn btn-sm" onclick="copyRow(' + l.index + ')" title="复制原文=译文">复制</button>' +
        '</td>' +
      '</tr>';
    });
    compareHtml += '</tbody></table>';
    $('cardCompare').innerHTML = compareHtml;
  }
  if (q) $('compareSearchCount').textContent = shown + ' 条匹配';
  updateSelectAllCompare();
}

// ── Preview Checkbox Handlers ──
function updatePreviewSelectAllVisibility() {
  var master = document.getElementById('selectAllPreview');
  var btn = document.getElementById('btnTranslatePreviewSel');
  var hasLines = state.lines.length > 0;
  if (master) master.style.display = hasLines ? '' : 'none';
  if (btn) { btn.style.display = hasLines ? '' : 'none'; btn.disabled = state.translating; }
}

function onPreviewCheck(cb) {
  var idx = parseInt(cb.dataset.index);
  if (cb.checked) { state.previewChecked.add(idx); }
  else { state.previewChecked.delete(idx); }
  updateSelectAllPreview();
}

function toggleSelectAllPreview() {
  var master = document.getElementById('selectAllPreview');
  if (!master) return;
  var checks = document.querySelectorAll('.preview-check');
  checks.forEach(function (cb) {
    cb.checked = master.checked;
    var idx = parseInt(cb.dataset.index);
    if (master.checked) { state.previewChecked.add(idx); }
    else { state.previewChecked.delete(idx); }
  });
}

function updateSelectAllPreview() {
  if (!state.lines.length) return;
  var q = state.previewQuery;
  var visible;
  if (q) {
    visible = state.lines.filter(function (l) {
      return matches(l.original, q) || matches(l.translation, q) || matches(l.new_translation, q);
    });
  } else {
    visible = state.lines.slice(0, 200);
  }
  if (!visible.length) return;
  var allIndices = new Set();
  visible.forEach(function (l) { allIndices.add(l.index); });
  var checked = 0;
  state.previewChecked.forEach(function (i) { if (allIndices.has(i)) checked++; });
  var master = document.getElementById('selectAllPreview');
  if (!master) return;
  master.checked = checked > 0 && checked === allIndices.size;
  master.indeterminate = checked > 0 && checked < allIndices.size;
  updateExportCheckedButton();
}

function getCheckedPreviewIndices() {
  return Array.from(state.previewChecked).sort(function (a, b) { return a - b; });
}

// ── Compare Checkbox Handlers ──
function onCompareCheck(cb) {
  var idx = parseInt(cb.dataset.index);
  if (cb.checked) { state.compareChecked.add(idx); }
  else { state.compareChecked.delete(idx); }
  updateSelectAllCompare();
}

function toggleSelectAllCompare() {
  var master = document.getElementById('selectAllCompare');
  if (!master) return;
  var checks = document.querySelectorAll('.row-check');
  checks.forEach(function (cb) {
    cb.checked = master.checked;
    var idx = parseInt(cb.dataset.index);
    if (master.checked) { state.compareChecked.add(idx); }
    else { state.compareChecked.delete(idx); }
  });
}

function updateSelectAllCompare() {
  var checkable = state.lines.filter(function (l) { return l.new_translation || l.error; });
  if (!checkable.length) return;
  var allIndices = new Set(checkable.map(function (l) { return l.index; }));
  var checked = 0;
  state.compareChecked.forEach(function (i) { if (allIndices.has(i)) checked++; });
  var master = document.getElementById('selectAllCompare');
  if (!master) return;
  master.checked = checked > 0 && checked === allIndices.size;
  master.indeterminate = checked > 0 && checked < allIndices.size;
  updateExportCheckedButton();
}

function getCheckedRows() {
  return state.lines.filter(function (l) { return state.compareChecked.has(l.index); });
}

// ── Preview Row Limit ──
function onPreviewRowLimitChange() {
  var sel = document.getElementById('previewRowLimit');
  var custom = document.getElementById('previewCustomLimit');
  if (!sel) return;
  var val = sel.value;
  if (val === '-2') {
    // 自定：隐藏下拉，显示输入框
    sel.style.display = 'none';
    if (custom) { custom.style.display = 'inline-block'; custom.focus(); }
    return;
  }
  if (val === '-1') {
    // 全部
    state.previewRowLimit = 0;
  } else {
    state.previewRowLimit = parseInt(val) || 2000;
  }
  if (custom) custom.style.display = 'none';
  if (sel) sel.style.display = 'inline-block';
  renderPreview();
}

function onPreviewCustomLimitChange() {
  var custom = document.getElementById('previewCustomLimit');
  if (!custom) return;
  var v = parseInt(custom.value);
  if (v > 0) {
    state.previewRowLimit = v;
    renderPreview();
  }
}

function initPreviewRowLimit() {
  var sel = document.getElementById('previewRowLimit');
  if (sel) sel.value = '2000';
  state.previewRowLimit = 2000;
}
