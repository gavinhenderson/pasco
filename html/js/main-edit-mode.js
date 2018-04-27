
/** <Edit Mode> **/

function _edit_mode_toggle(b, restart) {
  if(state._changing_edit_mode)
    return;
  state._changing_edit_mode = true;
  document.querySelector('#edit-config-btn')
    .classList[b?'add':'remove']('hide');
  document.querySelector('#help-btn')
    .classList[b?'add':'remove']('hide');
  document.querySelector('#edit-mode-btn')
    .classList[b?'add':'remove']('disabled');
  document.querySelector('#edit-mode-save-btn')
    .classList[!b?'add':'remove']('hide');
  document.querySelector('#edit-mode-cancel-btn')
    .classList[!b?'add':'remove']('hide');
  tree_element[(b?'add':'remove')+'EventListener']
    ('click', _edit_mode_on_tree_click, false)
  tree_element[(b?'add':'remove')+'EventListener']
    ('x-new-move', _edit_mode_on_new_move, true)
  tree_element.classList[b?'add':'remove']('edit-mode')
  if(!b) {
    // remove previously selected
    if(state._selected_node) {
      state._selected_node.dom_element.classList.remove('selected')
      state._selected_node.content_element
        .removeChild(state._selected_node._edit_overlay)
      delete state._selected_node._edit_overlay
      delete state._selected_node
    }
  }
  var promise;
  if(restart) {
    promise = stop()
      .then(function() {
        renew_state(state)
        return start(state)
      });
  } else {
    promise = Promise.resolve();
  }
  return promise.then(function() {
    state.silent_mode = b
    state.mode = b ? 'switch' : config.mode || 'auto'
    state.edit_mode = b
    delete state._changing_edit_mode;
  });
}

function _remove_child_node(parent, idx) {
  var node = parent.nodes[idx]
  parent.nodes.splice(idx, 1);
  node.dom_element.parentNode.removeChild(node.dom_element)
  if(parent.nodes.length == 0) {
    delete parent.nodes
    parent.is_leaf = true
  }
}
function _add_new_node(parent, index, override) {
  var ul = parent.dom_element.querySelector(':scope > ul.children')
  if(!ul) {
    ul = newEl('ul')
    ul.classList.add('children')
    parent.dom_element.appendChild(ul)
  }
  if(!parent.nodes)
    parent.nodes = [];
  parent.is_leaf = false;
  if(index > parent.nodes.length)
    throw new Error("index out of range!");
  var new_node = {
    text: 'New',
    meta: {},
    _more_meta: {},
    level: parent.level + 1,
    parent: parent,
    is_leaf: true
  };
  if(override)
    new_node = Object.assign(new_node, override);
  var new_li = newEl('li');
  tree_mk_list_base(new_node, new_li);
  var node_after = parent.nodes[index]
  if(!node_after)
    ul.appendChild(new_li);
  else
    ul.insertBefore(new_li, node_after.dom_element);
  parent.nodes.splice(index, 0, new_node);
  return new_node
}
function _edit_mode_select(node) {
  if(state._selected_node == node)
    return; // already selected
  // remove previously selected
  if(state._selected_node) {
    state._selected_node.dom_element.classList.remove('selected')
    state._selected_node.content_element
      .removeChild(state._selected_node._edit_overlay)
    delete state._selected_node._edit_overlay
  }
  if(!node.content_element)
    return; // no good
  node.dom_element.classList.add('selected')
  var edit_overlay = newEl('div');
  edit_overlay.innerHTML = document.querySelector('#node-edit-overlay').innerHTML
  edit_overlay.classList.add("node-edit-overlay");
  var inp_txt = edit_overlay.querySelector('[name=text]')
  if(inp_txt) {
    var txt = node.text + 
        (node._more_meta['auditory-cue-in-text'] &&
         node.meta['auditory-cue'] ?
         '(' + node.meta['auditory-cue'] + ')' : '');
    inp_txt.value = txt;
    inp_txt.addEventListener('blur', function(evt) {
      if(config._theinput_enabled) {
        keyevents_handle_theinput();
      }
    }, false);
    function onbefore_other_blur() {
      if(config._theinput_enabled) {
        keyevents_handle_theinput_off();
      }
    }
    inp_txt.addEventListener('touchend', onbefore_other_blur, false);
    inp_txt.addEventListener('mouseup', onbefore_other_blur, false);
    inp_txt.addEventListener('input', function(evt) {
      var data = parse_dom_tree_subrout_parse_text(inp_txt.value);
      node.text = data.text;
      if(data.meta['auditory-cue'])
        node.meta['auditory-cue'] = data.meta['auditory-cue'];
      else
        delete node.meta['auditory-cue'];
      node._more_meta['auditory-cue-in-text'] = !!data._more_meta['auditory-cue-in-text'];
      if(node.txt_dom_element)
        node.txt_dom_element.textContent = node.text
    }, false);
    inp_txt.addEventListener('keydown', function(evt) {
      var code = evt.keyCode;
      evt.stopPropagation()
      if(code == 27 || code == 13) { // escape or enter
        evt.preventDefault();
        inp_txt.blur()
      }
    }, false);
  }
  node.content_element.appendChild(edit_overlay);
  node._edit_overlay = edit_overlay;
  state._selected_node = node;
}
function _edit_mode_on_new_move(evt) {
  _edit_mode_select(evt.detail.node)
}
function _edit_mode_on_tree_click(evt) {
  var elm = evt.target,
      node, node_elm, btn, edit_overlay;
  if(elm.classList.contains('children')) {
    return; // no good
  }
  while(elm != null) {
    if(!btn && elm.nodeName == 'BUTTON')
      btn = elm;
    if(elm.classList.contains('node-edit-overlay'))
      edit_overlay = elm;
    if(elm.classList.contains('node')) {
      node_elm = elm;
      node = node_elm.target_node;
      break;
    }
    elm = elm.parentNode
  }
  if(elm == null || !node || !node.parent) // not found or invalid
    return;
  if(btn) {
    if(btn.classList.contains('add-node-before')) {
      var idx = node.parent.nodes.indexOf(node)
      if(idx == -1)
        throw new Error("Corrupt tree!");
      var new_node = _add_new_node(node.parent, idx)
      _tree_move(new_node) // is silent move
    } else if(btn.classList.contains('add-node-after')) {
      var idx = node.parent.nodes.indexOf(node)
      if(idx == -1)
        throw new Error("Corrupt tree!");
      var new_node = _add_new_node(node.parent, idx + 1)
      _tree_move(new_node) // is silent move
    } else if(btn.classList.contains('add-child-node')) {
      var new_node = _add_new_node(node, node.nodes ? node.nodes.length : 0)
      _tree_move(new_node) // is silent move
    } else if(btn.classList.contains('remove-node')) {
      var idx = node.parent.nodes.indexOf(node)
      if(idx == -1)
        throw new Error("Corrupt tree!");
      var parent = node.parent;
      _remove_child_node(parent, idx);
      var anode = !parent.nodes || idx >= parent.nodes.length ||
          parent.nodes.length == 0 ? parent : parent.nodes[idx]
      _tree_move(anode) // is silent move
    } else if(btn.classList.contains('node-setting')) {
      // bootstrap modal
      function on_modal_hidden() {
        $('#node-setting-modal').off('hidden.bs.modal', on_modal_hidden);
        if(config._theinput_enabled) {
          keyevents_handle_theinput();
        }
        state._keyhit_off = false;
        editor_helper.node_setting_modal_unbind();
      }
      if(config._theinput_enabled) {
        keyevents_handle_theinput_off();
      }
      state._keyhit_off = true;
      $('#node-setting-modal').modal('show')
        .on('hidden.bs.modal', on_modal_hidden);
      editor_helper.node_setting_modal_bind(_get_current_node());
    }
  } else {
    if(edit_overlay && evt.target != edit_overlay)
      return; // click was for overlay elements
    // select
    evt.preventDefault();
    _tree_move(node);
  }
}
function _on_edit_mode(evt) {
  if(evt)
    evt.preventDefault();
  if(document.querySelector('#edit-mode-btn').classList.contains('disabled')) {
    return;
  }
  state._orig_snapshot = _take_snapshot()
  _edit_mode_toggle(true, true)
}
function _on_edit_save(evt) {
  if(evt)
    evt.preventDefault();
  var save_btn = document.querySelector('#edit-mode-save-btn'),
      cancel_btn = document.querySelector('#edit-mode-cancel-btn');
  save_btn.disabled = true;
  cancel_btn.disabled = true;
  // save
  editor_helper.on_save(tree)
    .then(function() {
      var tree_md = tree_to_markdown(tree)
      return set_file_data(tree_fn, tree_md)
    })
    .then(function() {
      // did save
      save_btn.disabled = false;
      cancel_btn.disabled = false;
      _edit_mode_toggle(false);
      delete state._orig_snapshot;
    })
    .catch(function(err) {
      save_btn.disabled = false;
      cancel_btn.disabled = false;
      handle_error(err)
    });
}
function _on_edit_cancel(evt) {
  if(evt)
    evt.preventDefault();
  editor_helper.on_restore(tree)
    .then(function() {
      // restore will stop => auto toggle off
      // _edit_mode_toggle(false);
      return _restore_snapshot(state._orig_snapshot)
        .then(function() {
          delete state._orig_snapshot;
        });
    })
    .catch(handle_error);
}
/** <Edit Mode/> **/