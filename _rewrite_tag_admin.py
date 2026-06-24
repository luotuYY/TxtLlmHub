import os, re

path = r'C:\Users\666\Desktop\LLM\static\js\tag.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# ═══════════════════════════════════════════════════════════
# 1. Add sub_pool functions after saveTagSchema
# ═══════════════════════════════════════════════════════════
pool_helpers = '''

// ── 二级类目池持久化（独立于 schema） ──
function getSubPool() {
  try {
    var saved = localStorage.getItem('tllmh_sub_pool');
    if (saved) {
      var arr = JSON.parse(saved);
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) { /* ignore */ }
  return [];
}
function saveSubPool(pool) {
  localStorage.setItem('tllmh_sub_pool', JSON.stringify(pool));
}
'''

insert_marker = 'function saveTagSchema(schema) {'
idx = content.find(insert_marker)
save_end = content.index('\n}\n', idx)
save_end = content.index('\n', save_end + 2)

content = content[:save_end+1] + pool_helpers + content[save_end+1:]

# ═══════════════════════════════════════════════════════════
# 2. Rewrite tagOpenAdmin - find by next function boundary
# ═══════════════════════════════════════════════════════════
tag_open_start = content.index('function tagOpenAdmin() {')
tag_add_sub = content.index('function tagAdminAddSub(btn)', tag_open_start)
# The end of tagOpenAdmin is a few chars before tagAdminAddSub (after }\n)
# Find the last }\n before tagAdminAddSub
end_marker = content.rindex('\n}\n', tag_open_start, tag_add_sub)
tag_open_end = end_marker + 3  # include \n}\n

new_tag_open_admin = r'''function tagOpenAdmin() {
  var schema = getTagSchema();
  var subPool = getSubPool();

  // Build set of all subs currently assigned to any primary
  var assignedSubs = new Set();
  Object.keys(schema).forEach(function(l1) {
    (schema[l1].subs || []).forEach(function(s) { assignedSubs.add(s); });
  });

  // Pool items = those in subPool not assigned anywhere
  var availablePool = subPool.filter(function(s) { return !assignedSubs.has(s); });

  var modal = document.getElementById('tagAdminModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'tagAdminModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML =
      '<div class="modal-box tag-admin-modal">' +
        '<div class="modal-msg" style="font-weight:600;margin-bottom:6px">🏷️ 管理分类标签</div>' +
        '<div id="tagAdminBody" class="tag-admin-layout">' +
          '<div class="tag-admin-left" id="tagAdminLeft"></div>' +
          '<div class="tag-admin-right">' +
            '<div style="font-size:0.75rem;font-weight:600;color:var(--text-secondary);margin-bottom:6px">二级类目池</div>' +
            '<div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:6px">拖入左侧一级类目下分配 · 双击编辑 · 仅此处可删除</div>' +
            '<div class="tag-admin-pool" id="tagAdminPool" ondragover="event.preventDefault()"></div>' +
            '<button class="btn btn-sm" onclick="tagAdminAddToPool()" style="margin-top:8px;width:100%%">+ 添加二级类目</button>' +
          '</div>' +
        '</div>' +
        '<div class="modal-actions" style="margin-top:10px">' +
          '<button class="btn" onclick="tagAdminExport()" title="导出当前标签体系为 JSON 文件">📤 导出</button>' +
          '<button class="btn" onclick="tagAdminImport()" title="从 JSON 文件导入标签体系">📥 导入</button>' +
          '<span style="flex:1"></span>' +
          '<button class="btn btn-primary" id="tagAdminSave">保存并关闭</button>' +
          '<button class="btn" id="tagAdminCancel">取消</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.style.display = 'none'; });
    document.getElementById('tagAdminCancel').onclick = function() { modal.style.display = 'none'; };
    document.getElementById('tagAdminSave').onclick = _adminSave;
  }

  // Render left panel
  var leftHtml = '<div class="tag-admin-hint">双击类目名称编辑 · 删除一级类目时其子项回归二级池</div>';
  leftHtml += '<div id="tagAdminList">';
  Object.keys(schema).forEach(function(l1) {
    var cat = schema[l1];
    var disabledCls = cat.enabled === false ? ' tag-admin-disabled' : '';
    leftHtml +=
      '<div class="tag-admin-group' + disabledCls + '" data-l1="' + escHtml(l1) + '"' +
        ' ondragover="tagAdminDragOver(event, this)"' +
        ' ondragleave="tagAdminDragLeave(event, this)"' +
        ' ondrop="tagAdminDrop(event, this)">' +
        '<div class="tag-admin-group-header">' +
          '<label class="tag-admin-enabled-wrap" title="启用/禁用">' +
            '<input type="checkbox" class="tag-admin-enabled"' + (cat.enabled !== false ? ' checked' : '') +
              ' onchange="this.closest(\'.tag-admin-group\').classList.toggle(\'tag-admin-disabled\', !this.checked)">' +
          '</label>' +
          '<input class="tag-admin-icon" value="' + escHtml(cat.icon || '📌') + '" style="width:30px;text-align:center">' +
          '<input class="tag-admin-name" value="' + escHtml(l1) + '" style="flex:1"' +
            ' ondblclick="this.readOnly=false;this.focus();this.select()"' +
            ' onblur="this.readOnly=true"' +
            ' readonly>' +
          '<input class="tag-admin-color" type="color" value="' + (cat.color || '#888') + '" title="颜色">' +
          '<button class="btn btn-sm" onclick="tagAdminAddSub(this)">+子项</button>' +
          '<button class="btn btn-sm tag-admin-del-btn" onclick="tagAdminRemoveGroup(this)">🗑</button>' +
        '</div>' +
        '<div class="tag-admin-subs">';
    (cat.subs || []).forEach(function(sub) {
      leftHtml += '<span class="tag-admin-sub-wrap">' +
        '<input class="tag-admin-sub" value="' + escHtml(sub) + '"' +
          ' ondblclick="this.readOnly=false;this.focus();this.select()"' +
          ' onblur="this.readOnly=true"' +
          ' readonly>' +
        '<span class="tag-admin-sub-del" onclick="tagAdminRemoveSub(this)" title="移回二级池">&times;</span>' +
      '</span>';
    });
    leftHtml += '</div></div>';
  });
  leftHtml += '</div>';
  leftHtml += '<button class="btn btn-sm" onclick="tagAdminAddGroup()" style="margin-top:4px">+ 添加一级类目</button>';
  document.getElementById('tagAdminLeft').innerHTML = leftHtml;

  // Render right panel
  var poolHtml = '';
  availablePool.forEach(function(name) {
    poolHtml +=
      '<div class="tag-admin-pool-chip" draggable="true"' +
        ' ondragstart="tagAdminPoolDragStart(event, this)"' +
        ' ondragend="tagAdminPoolDragEnd(event, this)"' +
        ' ondblclick="tagAdminPoolEdit(event, this)">' +
        '<span class="tag-admin-pool-text">' + escHtml(name) + '</span>' +
        '<span class="tag-admin-pool-del" onclick="tagAdminDeletePoolItem(event, this)" title="永久删除">&times;</span>' +
      '</div>';
  });
  if (poolHtml === '') {
    poolHtml = '<div style="font-size:0.68rem;color:var(--text-muted);text-align:center;padding:12px 0">池中暂无二级类目<br>点击下方按钮添加</div>';
  }
  document.getElementById('tagAdminPool').innerHTML = poolHtml;

  modal.style.display = 'flex';
}
'''

content = content[:tag_open_start] + new_tag_open_admin + '\n\n' + content[tag_open_end:]

# ═══════════════════════════════════════════════════════════
# 3. Rewrite tagAdminRemoveGroup
# ═══════════════════════════════════════════════════════════
old_remove = 'function tagAdminRemoveGroup(btn) {\n  if (document.querySelectorAll(\'.tag-admin-group\').length <= 1) {\n    showToast(\'至少保留一个一级类目\');\n    return;\n  }\n  btn.closest(\'.tag-admin-group\').remove();\n}'
new_remove = 'function tagAdminRemoveGroup(btn) {\n  if (document.querySelectorAll(\'.tag-admin-group\').length <= 1) {\n    showToast(\'至少保留一个一级类目\');\n    return;\n  }\n  var group = btn.closest(\'.tag-admin-group\');\n  var subInputs = group.querySelectorAll(\'.tag-admin-sub\');\n  var pool = getSubPool();\n  subInputs.forEach(function(input) {\n    var val = (input.value || input.defaultValue || \'\').trim();\n    if (val && pool.indexOf(val) === -1) pool.push(val);\n  });\n  saveSubPool(pool);\n  group.remove();\n}'
content = content.replace(old_remove, new_remove)

# ═══════════════════════════════════════════════════════════
# 4. Insert new functions after tagAdminRemoveGroup
# ═══════════════════════════════════════════════════════════
idx = content.index('function tagAdminRemoveGroup(btn)')
# Find end of the function
brace_count = 0
in_func = False
for i in range(idx, len(content)):
    if content[i] == '{' and not in_func:
        in_func = True
    if in_func:
        if content[i] == '{': brace_count += 1
        elif content[i] == '}': brace_count -= 1
        if brace_count == 0:
            func_end = i + 1
            break
# Move past any trailing newlines
while func_end < len(content) and content[func_end] in '\n\r':
    func_end += 1

new_funcs = '''
// ── 从一级类目下移除子项（回归二级池） ──
function tagAdminRemoveSub(el) {
  var input = el.parentElement.querySelector('.tag-admin-sub');
  var name = (input.value || input.defaultValue || '').trim();
  el.parentElement.remove();
  if (name) {
    var pool = getSubPool();
    if (pool.indexOf(name) === -1) { pool.push(name); saveSubPool(pool); }
    _refreshPool();
  }
}

// ── 池子拖拽事件 ──
function tagAdminPoolDragStart(e, el) {
  e.dataTransfer.setData('text/plain', el.querySelector('.tag-admin-pool-text').textContent);
  e.dataTransfer.effectAllowed = 'move';
  el.classList.add('drag-start');
  setTimeout(function() { if (el) el.classList.remove('drag-start'); }, 0);
}
function tagAdminPoolDragEnd(e, el) {
  el.classList.remove('drag-start');
}

// ── 一级类目 drop 区域 ──
function tagAdminDragOver(e, group) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  group.classList.add('drag-over');
}
function tagAdminDragLeave(e, group) {
  group.classList.remove('drag-over');
}
function tagAdminDrop(e, group) {
  e.preventDefault();
  group.classList.remove('drag-over');
  var name = e.dataTransfer.getData('text/plain');
  if (!name) return;
  // 检查是否已在任何一级类目中
  var schema = getTagSchema();
  var assigned = false;
  Object.keys(schema).forEach(function(l1) {
    if ((schema[l1].subs || []).indexOf(name) !== -1) assigned = true;
  });
  if (assigned) { showToast('"' + name + '" 已在其他一级类目中'); return; }
  // 从池子移除
  var pool = getSubPool();
  var idx = pool.indexOf(name);
  if (idx === -1) return;
  pool.splice(idx, 1);
  saveSubPool(pool);
  // 添加到该类目
  var subHtml = '<span class="tag-admin-sub-wrap">' +
    '<input class="tag-admin-sub" value="' + escHtml(name) + '"' +
      ' ondblclick="this.readOnly=false;this.focus();this.select()"' +
      ' onblur="this.readOnly=true"' +
      ' readonly>' +
    '<span class="tag-admin-sub-del" onclick="tagAdminRemoveSub(this)" title="移回二级池">&times;</span>' +
  '</span>';
  var subsDiv = group.querySelector('.tag-admin-subs');
  var temp = document.createElement('div');
  temp.innerHTML = subHtml;
  subsDiv.appendChild(temp.firstElementChild);
  _refreshPool();
}

// ── 池子双击编辑 ──
function tagAdminPoolEdit(e, el) {
  if (e.target.classList.contains('tag-admin-pool-del')) return;
  var textSpan = el.querySelector('.tag-admin-pool-text');
  var oldName = textSpan.textContent;
  var input = document.createElement('input');
  input.type = 'text';
  input.value = oldName;
  input.className = 'tag-admin-sub';
  input.style.cssText = 'width:calc(100% - 18px);padding:2px 4px;font-size:0.73rem';
  textSpan.replaceWith(input);
  input.focus();
  input.select();
  function commit() {
    var newName = input.value.trim();
    if (newName && newName !== oldName) {
      var pool = getSubPool();
      var idx = pool.indexOf(oldName);
      if (idx !== -1) {
        pool[idx] = newName;
        saveSubPool(pool);
      }
    }
    var span = document.createElement('span');
    span.className = 'tag-admin-pool-text';
    span.textContent = newName || oldName;
    input.replaceWith(span);
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', function(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
    if (ev.key === 'Escape') { input.value = oldName; commit(); }
  });
}

// ── 永久删除池子条目 ──
function tagAdminDeletePoolItem(e, el) {
  e.stopPropagation();
  var chip = el.closest('.tag-admin-pool-chip');
  var name = chip.querySelector('.tag-admin-pool-text').textContent;
  var pool = getSubPool();
  var idx = pool.indexOf(name);
  if (idx !== -1) { pool.splice(idx, 1); saveSubPool(pool); }
  chip.remove();
  if (document.querySelectorAll('.tag-admin-pool-chip').length === 0) {
    _refreshPool();
  }
}

// ── 添加新条目到池子 ──
function tagAdminAddToPool() {
  var name = prompt('输入新二级类目名称：');
  if (!name || !name.trim()) return;
  name = name.trim();
  var pool = getSubPool();
  if (pool.indexOf(name) !== -1) { showToast('此名称已存在'); return; }
  // 也检查是否已在 schema 中
  var schema = getTagSchema();
  var assigned = false;
  Object.keys(schema).forEach(function(l1) {
    if ((schema[l1].subs || []).indexOf(name) !== -1) assigned = true;
  });
  if (assigned) { showToast('该名称已在分类中使用'); return; }
  pool.push(name);
  saveSubPool(pool);
  _refreshPool();
}

// ── 刷新右侧池子 DOM ──
function _refreshPool() {
  var container = document.getElementById('tagAdminPool');
  if (!container) return;
  var schema = getTagSchema();
  var subPool = getSubPool();
  var assignedSubs = new Set();
  Object.keys(schema).forEach(function(l1) {
    (schema[l1].subs || []).forEach(function(s) { assignedSubs.add(s); });
  });
  var available = subPool.filter(function(s) { return !assignedSubs.has(s); });
  if (available.length === 0) {
    container.innerHTML = '<div style="font-size:0.68rem;color:var(--text-muted);text-align:center;padding:12px 0">池中暂无二级类目<br>点击下方按钮添加</div>';
    return;
  }
  var html = '';
  available.forEach(function(name) {
    html +=
      '<div class="tag-admin-pool-chip" draggable="true"' +
        ' ondragstart="tagAdminPoolDragStart(event, this)"' +
        ' ondragend="tagAdminPoolDragEnd(event, this)"' +
        ' ondblclick="tagAdminPoolEdit(event, this)">' +
        '<span class="tag-admin-pool-text">' + escHtml(name) + '</span>' +
        '<span class="tag-admin-pool-del" onclick="tagAdminDeletePoolItem(event, this)" title="永久删除">&times;</span>' +
      '</div>';
  });
  container.innerHTML = html;
}

// ── 保存逻辑 ──
function _adminSave() {
  var modal = document.getElementById('tagAdminModal');
  var newSchema = {};
  var groups = document.querySelectorAll('.tag-admin-group');
  groups.forEach(function(group) {
    var nameInput = group.querySelector('.tag-admin-name');
    var l1 = nameInput ? (nameInput.value || nameInput.defaultValue || '').trim() : '';
    var color = group.querySelector('.tag-admin-color');
    var colorVal = color ? color.value : '#888';
    var icon = group.querySelector('.tag-admin-icon');
    var iconVal = icon ? (icon.value || icon.defaultValue || '📌') : '📌';
    var enabled = group.querySelector('.tag-admin-enabled');
    var enabledVal = enabled ? enabled.checked : true;
    var subs = [];
    group.querySelectorAll('.tag-admin-sub').forEach(function(subInput) {
      var val = (subInput.value || subInput.defaultValue || '').trim();
      if (val) subs.push(val);
    });
    if (l1 && subs.length > 0) {
      newSchema[l1] = { color: colorVal, icon: iconVal, subs: subs, enabled: enabledVal };
    }
  });
  if (Object.keys(newSchema).length === 0) {
    showToast('至少保留一个一级类目');
    return;
  }
  // Save pool from DOM
  var poolChips = document.querySelectorAll('.tag-admin-pool-chip');
  var newPool = [];
  poolChips.forEach(function(chip) {
    var txt = chip.querySelector('.tag-admin-pool-text');
    if (txt) newPool.push(txt.textContent.trim());
  });
  saveSubPool(newPool);
  saveTagSchema(newSchema);
  modal.style.display = 'none';
  tagRenderColumns();
  tagRenderPreview();
  tagRenderCatPanel();
  tagBtnState();
  showToast('标签体系已更新');
}
'''

content = content[:func_end] + new_funcs + '\n' + content[func_end:]

with open(path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print('OK: tag.js rewritten successfully')
print('  - Added getSubPool/saveSubPool helpers')
print('  - Rewrote tagOpenAdmin with two-column layout')  
print('  - Added drag-and-drop handlers')
print('  - Added double-click editing')
print('  - Pool items return on deletion')
print('  - Only pool items can be permanently deleted')