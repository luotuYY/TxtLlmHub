/**
 * LinguaForge — 渲染层
 * 预览列表、对比表格的 DOM 渲染，搜索 UI，复选框/排序状态管理
 * Depends on: utils.js, state.js
 */

import { $, escHtml, setHighlight, hl, matches, naturalCompare } from './utils.js';
import { state, updateExportCheckedButton } from './state.js';
// ── 文件过滤 ──
function getCheckedFileNames() {
  return state.files.filter(function (f) { return f.checked; }).map(function (f) { return f.name; });
}


// ── 搜索 UI ──
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

// ── 预览列表 ──
function renderPreview() {
  var q = state.previewQuery;
  setHighlight(q);
  var checkedFiles = getCheckedFileNames();
  var filtered = state.lines.filter(function (l) {
    return !l.file || checkedFiles.indexOf(l.file) >= 0;
  });
  var lines = filtered.slice();
  if (q) {
    lines = lines.filter(function (l) {
      return matches(l.original, q) || matches(l.translation, q) || matches(l.new_translation, q);
    });
  }
  var total = lines.length;
  var perPage = state.previewRowLimit || 200;
  var totalPages = Math.max(1, Math.ceil(total / perPage));
  if (state.previewPage > totalPages) state.previewPage = totalPages;
  if (state.previewPage < 1) state.previewPage = 1;
  var start = (state.previewPage - 1) * perPage;
  var pageLines = lines.slice(start, start + perPage);

  if (state.lines.length === 0) {
    $('cardPreview').innerHTML = '<div class="empty-state">请先上传 txt 文件</div>';
  } else if (q && total === 0) {
    $('cardPreview').innerHTML = '<div class="empty-state">无匹配结果</div>';
  } else {
    var previewHtml = '<div class="line-list">';
    pageLines.forEach(function (l) {
      previewHtml += '<div class="line-item">' +
        '<span class="line-num">' + (l.index + 1) + '</span>' +
        '<span class="line-text">' +
          '<span class="orig">' + hl(l.original) + '</span>' +
          (l.translation ? '<span class="sep">=</span><span class="tran">' + hl(l.translation) + '</span>' : '') +
          (l.new_translation ? '<span class="sep">\u2192</span><span style="color:var(--green)">' + hl(l.new_translation) + '</span>' : '') +
        '</span>' +
        '<span class="line-actions">' +
          '<button class="btn" data-action="delete-preview-line" data-index="' + l.index + '" title="删除此条目">\uD83D\uDDD1</button>' +
          '<button class="btn" data-action="translate-one" data-index="' + l.index + '" ' + (state.translating ? 'disabled' : '') + '>\u8BD1</button>' +
        '</span>' +
        '<span class="line-check-wrap">' +
          '<input type="checkbox" class="preview-check" data-index="' + l.index + '" data-action="preview-check" ' + (state.previewChecked.has(l.index) ? 'checked' : '') + '>' +
        '</span>' +
      '</div>';
    });
    previewHtml += '</div>';
    previewHtml += _renderPagination(total, perPage, state.previewPage, 'preview');
    $('cardPreview').innerHTML = previewHtml;
    _bindPagination('cardPreview', 'preview', {
      onPage: function(p) { state.previewPage = p; renderPreview(); },
      onRowsPerPage: function(v) { state.previewRowLimit = v; state.previewPage = 1; state.comparePage = 1; renderPreview(); renderCompare(); }
    });
  }
  $('previewSearchCount').textContent = q
    ? total + ' 条匹配'
    : filtered.length + ' 行';
  updatePreviewSelectAllVisibility();
  updateSelectAllPreview();
}

// ── 编辑保护：翻译进行中编辑 textarea 时不重建 DOM ──
const renderInternal = { compareDirty: false };

// ── 增量更新预览列表单条 ──
function updatePreviewLine(index) {
  var l = state.lines[index];
  if (!l) return;
  var item = document.querySelector('.line-item .preview-check[data-index="' + index + '"]');
  if (!item) return;
  var lineItem = item.closest('.line-item');
  if (!lineItem) return;
  lineItem.innerHTML =
    '<span class="line-num">' + (l.index + 1) + '</span>' +
    '<span class="line-text">' +
      '<span class="orig">' + hl(l.original) + '</span>' +
      (l.translation ? '<span class="sep">=</span><span class="tran">' + hl(l.translation) + '</span>' : '') +
      (l.new_translation ? '<span class="sep">\u2192</span><span style="color:var(--green)">' + hl(l.new_translation) + '</span>' : '') +
    '</span>' +
    '<span class="line-actions">' +
      '<button class="btn" data-action="delete-preview-line" data-index="' + l.index + '" title="删除此条目">🗑</button>' +
      '<button class="btn" data-action="translate-one" data-index="' + l.index + '" ' + (state.translating ? 'disabled' : '') + '>译</button>' +
    '</span>' +
    '<span class="line-check-wrap">' +
      '<input type="checkbox" class="preview-check" data-index="' + l.index + '" data-action="preview-check" ' + (state.previewChecked.has(l.index) ? 'checked' : '') + '>' +
    '</span>';
}

// ════════════════════════════════════════════════════════════════
//  对比表 — 公共渲染函数
// ════════════════════════════════════════════════════════════════

// ── 构建「新译文」单元格 HTML ──
function _buildNewCellHtml(l) {
  if (l.error) return '\u26A0' + escHtml(l.error);
  if (l.new_translation === ' ') return '<span class="cleared-mark">\u2014</span>';
  var html = hl(l.new_translation);
  if (l.truncated) html += ' <span title="响应被截断，翻译可能不完整" style="cursor:help">\u26A0\uFE0F</span>';
  if (l.warning && !l.truncated) html += ' <span title="' + escHtml(l.warning) + '" style="cursor:help;color:var(--yellow)">\u26A0\uFE0F</span>';
  if (l.degraded) html += ' <span title="无旧译文，已降级为直译" style="cursor:help;color:var(--text-muted)">↓</span>';
  return html;
}

// ── 构建单行 HTML（tr 内容） ──
function _buildCompareRowHtml(l) {
  var rowCls = (l.error ? 'row-error' : '') + (l.keepOld ? ' row-keep' : '');
  return '<tr class="' + rowCls + '" data-row-index="' + l.index + '">' +
    '<td class="col-check"><input type="checkbox" class="row-check" data-index="' + l.index + '" data-action="compare-check" ' + (state.compareChecked.has(l.index) ? 'checked' : '') + '></td>' +
    '<td class="cell-copyable" data-action="copy-original" title="点击复制">' + hl(l.original) + '</td>' +
    '<td>' + (l.translation ? hl(l.translation) : '\u2014') + '</td>' +
    '<td class="cell-editable col-new" data-action="edit-translation" data-index="' + l.index + '" title="' + (l.warning || '点击编辑') + '">' + _buildNewCellHtml(l) + '</td>' +
    '<td class="col-actions">' +
      '<button class="btn btn-sm" data-action="keep-old" data-index="' + l.index + '" ' + (l.keepOld || !l.translation ? 'disabled' : '') + ' title="' + (!l.translation ? '无原译文可保留' : l.keepOld ? '已标记保留' : '用旧译文替换新译文') + '">' + (l.keepOld ? '已保留' : '保留译文') + '</button>' +
      '<button class="btn btn-sm" data-action="retry-one" data-index="' + l.index + '">重译</button>' +
      '<button class="btn btn-sm" data-action="copy-row" data-index="' + l.index + '" title="复制原文=译文">复制</button>' +
    '</td>' +
  '</tr>';
}

// ── 对比表排序 ──
function toggleSort() {
  state.sortState = (state.sortState + 1) % 3;
  var labels = ['\u25BC', '\u25BCO', '\u25BCN'];
  var titles = ['按原文排序', '按新译文排序', '恢复原始顺序'];
  var btn = $('btnSort');
  if (btn) { btn.textContent = labels[state.sortState]; btn.title = titles[state.sortState]; }
  renderCompare();
}

// ── 对比表全量渲染 ──
function renderCompare() {
  // 编辑进行中：跳过重建，标记为待刷新
  if (document.querySelector('.compare-table .inline-edit')) {
    renderInternal.compareDirty = true;
    return;
  }
  // 批量翻译进行中：禁止全量重建，由 updateCompareRow() 增量处理
  if (_batchUpdating) return;
  renderInternal.compareDirty = false;

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

  // 空状态
  if (state.lines.every(function (l) { return !l.new_translation && !l.error; })) {
    $('cardCompare').innerHTML = '<div class="empty-state">翻译后将在此显示前后对比</div>';
    return;
  }
  if (q && shown === 0) {
    $('cardCompare').innerHTML = '<div class="empty-state">无匹配结果</div>';
    return;
  }

  // 排序
  var curSort = state.sortState;
  if (curSort === 1) rows.sort(function (a, b) { return naturalCompare(a.original, b.original); });
  else if (curSort === 2) rows.sort(function (a, b) { return naturalCompare(a.new_translation || '', b.new_translation || ''); });

  // 分页
  var total = rows.length;
  var perPage = state.previewRowLimit || 200;
  var totalPages = Math.max(1, Math.ceil(total / perPage));
  if (state.comparePage > totalPages) state.comparePage = totalPages;
  if (state.comparePage < 1) state.comparePage = 1;
  var start = (state.comparePage - 1) * perPage;
  var pageRows = rows.slice(start, start + perPage);

  // 渲染表格
  var html = '<table class="compare-table"><thead><tr>' +
    '<th class="col-check"><input type="checkbox" id="selectAllCompare" data-action="toggle-select-all-compare" title="全选/取消筛选结果"></th>' +
    '<th class="col-orig">原文</th>' +
    '<th class="col-old">旧译文</th>' +
    '<th class="col-new">新译文 <button class="btn btn-sm" data-action="clear-new-without-old" title="清空所有无旧译文词条的新译文" style="font-size:0.68rem;padding:1px 6px">清</button></th>' +
    '<th class="col-actions"></th>' +
  '</tr></thead><tbody>';
  pageRows.forEach(function (l) { html += _buildCompareRowHtml(l); });
  html += '</tbody></table>';
  html += _renderPagination(total, perPage, state.comparePage, 'compare');
  $('cardCompare').innerHTML = html;
  _bindComparePagination();
  if (q) $('compareSearchCount').textContent = shown + ' 条匹配';
  updateSelectAllCompare();
}

// ════════════════════════════════════════════════════════════════
//  对比表 — 增量更新（批量翻译专用）
// ════════════════════════════════════════════════════════════════

// ── 增量追加单行到对比表 ──
function _appendCompareRow(l) {
  var table = document.querySelector('.compare-table');
  var tbody;
  if (!table) {
    // 表格不存在，创建骨架
    $('cardCompare').innerHTML = '<table class="compare-table"><thead><tr>' +
      '<th class="col-check"><input type="checkbox" id="selectAllCompare" data-action="toggle-select-all-compare" title="全选/取消筛选结果"></th>' +
      '<th class="col-orig">原文</th>' +
      '<th class="col-old">旧译文</th>' +
      '<th class="col-new">新译文 <button class="btn btn-sm" data-action="clear-new-without-old" title="清空所有无旧译文词条的新译文" style="font-size:0.68rem;padding:1px 6px">清</button></th>' +
      '<th class="col-actions"></th>' +
    '</tr></thead><tbody></tbody></table>';
    tbody = document.querySelector('.compare-table tbody');
  } else {
    tbody = table.querySelector('tbody');
    if (!tbody) { tbody = document.createElement('tbody'); table.appendChild(tbody); }
    if (tbody.querySelector('tr[data-row-index="' + l.index + '"]')) return; // 已存在则跳过
  }
  // 用 fragment 批量插入，减少回流
  var tmp = document.createElement('tbody');
  tmp.innerHTML = _buildCompareRowHtml(l);
  tbody.appendChild(tmp.firstElementChild);
  _refreshComparePagination();
}

// ── 增量更新单行（翻译进行中避免全量重建） ──
function updateCompareRow(index) {
  var l = state.lines[index];
  if (!l) return;

  // 批量更新期间或无搜索/排序时：增量更新
  var row = document.querySelector('.compare-table tbody tr[data-row-index="' + index + '"]');
  if (!row) {
    // 行不存在 → 追加
    _appendCompareRow(l);
    return;
  }
  // 正在编辑则跳过
  if (row.querySelector('.inline-edit')) return;

  // 更新行样式
  row.className = (l.error ? 'row-error' : '') + (l.keepOld ? ' row-keep' : '');

  // 更新「新译文」单元格
  var newCell = row.querySelector('.col-new');
  if (newCell && !newCell.querySelector('.inline-edit')) {
    newCell.innerHTML = _buildNewCellHtml(l);
    newCell.className = 'cell-editable col-new';
    newCell.title = l.warning || '点击编辑';
  }

  // 更新「保留译文」按钮状态（用 data-action 选择器，修复原 onclick 选择器失效 bug）
  var keepBtn = row.querySelector('.col-actions button[data-action="keep-old"]');
  if (keepBtn) {
    keepBtn.disabled = !l.translation || l.keepOld;
    keepBtn.title = !l.translation ? '无原译文可保留' : l.keepOld ? '已标记保留' : '用旧译文替换新译文';
    keepBtn.textContent = l.keepOld ? '已保留' : '保留译文';
  }
}

// ════════════════════════════════════════════════════════════════
//  对比表 — 分页
// ════════════════════════════════════════════════════════════════

// ── 轻量翻页（仅切换行可见性 + 更新分页条，不触发全量重建） ──
function _comparePageTo(p) {
  var container = document.getElementById('cardCompare');
  if (!container) return;
  var rows = container.querySelectorAll('.compare-table tbody tr[data-row-index]');
  var perPage = state.previewRowLimit || 200;
  var total = rows.length;
  var totalPages = Math.max(1, Math.ceil(total / perPage));
  if (p < 1) p = 1;
  if (p > totalPages) p = totalPages;
  state.comparePage = p;
  var start = (p - 1) * perPage;
  var end = p * perPage;
  for (var i = 0; i < rows.length; i++) {
    rows[i].style.display = (i >= start && i < end) ? '' : 'none';
  }
  var pgBar = container.querySelector('.pagination-bar');
  if (pgBar) pgBar.outerHTML = _renderPagination(total, perPage, p, 'compare');
  _bindComparePagination();
  container.scrollTop = 0;
}

// ── 绑定对比表分页事件（可重复调用） ──
function _bindComparePagination() {
  _bindPagination('cardCompare', 'compare', {
    onPage: function(p) { _comparePageTo(p); },
    onRowsPerPage: function(v) {
      state.previewRowLimit = v;
      state.previewPage = 1;
      state.comparePage = 1;
      renderPreview();
      renderCompare();
    }
  });
}

// ── 刷新对比表分页（增量追加行时调用） ──
function _refreshComparePagination() {
  var container = document.getElementById('cardCompare');
  if (!container) return;
  var tbody = container.querySelector('.compare-table tbody');
  if (!tbody) return;
  var allRows = tbody.querySelectorAll('tr[data-row-index]');
  var total = allRows.length;
  var perPage = state.previewRowLimit || 200;

  if (total <= perPage) {
    for (var i = 0; i < allRows.length; i++) allRows[i].style.display = '';
    var pgBar = container.querySelector('.pagination-bar');
    if (pgBar) pgBar.remove();
    return;
  }

  var totalPages = Math.ceil(total / perPage);
  if (state.comparePage > totalPages) state.comparePage = totalPages;
  var start = (state.comparePage - 1) * perPage;
  var end = state.comparePage * perPage;
  for (var i = 0; i < allRows.length; i++) {
    allRows[i].style.display = (i >= start && i < end) ? '' : 'none';
  }

  var pgBar = container.querySelector('.pagination-bar');
  if (pgBar) {
    pgBar.outerHTML = _renderPagination(total, perPage, state.comparePage, 'compare');
  } else {
    container.insertAdjacentHTML('beforeend', _renderPagination(total, perPage, state.comparePage, 'compare'));
  }
  _bindComparePagination();
}

// ════════════════════════════════════════════════════════════════
//  预览 / 对比 — 复选框
// ════════════════════════════════════════════════════════════════

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
  var btn = document.getElementById('btnTranslatePreviewSel');
  if (btn) btn.disabled = !master.checked || state.translating;
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
    visible = state.lines;
  }
  var perPage = state.previewRowLimit || 200;
  var totalPages = Math.max(1, Math.ceil(visible.length / perPage));
  if (state.previewPage > totalPages) state.previewPage = totalPages;
  var start = (state.previewPage - 1) * perPage;
  visible = visible.slice(start, start + perPage);
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
  updateExportCheckedButton();
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

// ════════════════════════════════════════════════════════════════
//  通用分页控件
// ════════════════════════════════════════════════════════════════

function _renderPagination(total, perPage, currentPage, pageKey) {
  if (total <= perPage) return '';
  var totalPages = Math.ceil(total / perPage);
  var start = (currentPage - 1) * perPage + 1;
  var end = Math.min(currentPage * perPage, total);

  var html = '<div class="pagination-bar">';
  html += '<span class="pagination-info">' + start + '-' + end + ' / ' + total + ' 条</span>';
  html += '<div class="pagination-controls">';
  html += '<button data-pg="' + pageKey + '" data-page="' + (currentPage - 1) + '"' + (currentPage <= 1 ? ' disabled' : '') + '>&laquo;</button>';
  var pages = _calcPageRange(currentPage, totalPages);
  pages.forEach(function (p) {
    if (p === '...') {
      html += '<span class="pg-ellipsis">...</span>';
    } else {
      html += '<button data-pg="' + pageKey + '" data-page="' + p + '"' + (p === currentPage ? ' class="pg-active"' : '') + '>' + p + '</button>';
    }
  });
  html += '<button data-pg="' + pageKey + '" data-page="' + (currentPage + 1) + '"' + (currentPage >= totalPages ? ' disabled' : '') + '>&raquo;</button>';
  html += '</div>';
  html += '<div class="pagination-rowsper">';
  html += '<select data-pg-rowsper="' + pageKey + '">';
  [200, 500, 1000, 2000].forEach(function (n) {
    html += '<option value="' + n + '"' + (perPage === n ? ' selected' : '') + '>' + n + '</option>';
  });
  html += '</select>';
  html += '</div>';
  html += '</div>';
  return html;
}

function _calcPageRange(cur, total) {
  if (total <= 7) {
    var arr = [];
    for (var i = 1; i <= total; i++) arr.push(i);
    return arr;
  }
  var pages = [1];
  if (cur > 3) pages.push('...');
  for (var i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) {
    pages.push(i);
  }
  if (cur < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function _bindPagination(containerId, pageKey, callbacks) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('button[data-pg="' + pageKey + '"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var page = parseInt(btn.dataset.page);
      if (page < 1) return;
      if (callbacks && callbacks.onPage) callbacks.onPage(page);
      var el = document.getElementById(containerId);
      if (el) el.scrollTop = 0;
    });
  });
  var sel = container.querySelector('select[data-pg-rowsper="' + pageKey + '"]');
  if (sel) {
    sel.addEventListener('change', function () {
      var val = parseInt(sel.value) || 200;
      if (callbacks && callbacks.onRowsPerPage) callbacks.onRowsPerPage(val);
    });
  }
}

// ── 旧版行数限制（兼容） ──
function onPreviewRowLimitChange() { renderPreview(); }
function onPreviewCustomLimitChange() {}
function initPreviewRowLimit() { state.previewRowLimit = 200; }

// ── 批量翻译开始/结束标记（用于增量更新判断） ──
var _batchUpdating = false;
function setBatchUpdating(v) { _batchUpdating = v; }

// ── Module exports ──
export { renderInternal, getCheckedFileNames, updateSearchUI, renderPreview, updatePreviewLine, toggleSort, renderCompare, updatePreviewSelectAllVisibility, onPreviewCheck, toggleSelectAllPreview, updateSelectAllPreview, getCheckedPreviewIndices, onCompareCheck, toggleSelectAllCompare, updateSelectAllCompare, getCheckedRows, onPreviewRowLimitChange, onPreviewCustomLimitChange, initPreviewRowLimit, updateCompareRow, _appendCompareRow, setBatchUpdating, _renderPagination, _bindPagination };
