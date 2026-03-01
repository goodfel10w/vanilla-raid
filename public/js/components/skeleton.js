// ── Skeleton Loaders ──

/** Generate a skeleton card placeholder */
export function skeletonCard() {
  return `<div class="skeleton-card card">
    <div class="skeleton-line" style="width:40%;height:12px;margin-bottom:12px"></div>
    <div class="skeleton-line" style="width:80%;height:16px;margin-bottom:8px"></div>
    <div class="skeleton-line" style="width:60%;height:14px"></div>
  </div>`;
}

/** Generate N skeleton list items */
export function skeletonList(n = 5) {
  let html = '';
  for (let i = 0; i < n; i++) {
    const w = 50 + Math.floor(Math.random() * 40);
    html += `<div class="skeleton-item">
      <div class="skeleton-circle"></div>
      <div style="flex:1">
        <div class="skeleton-line" style="width:${w}%;height:14px;margin-bottom:6px"></div>
        <div class="skeleton-line" style="width:${Math.max(30, w - 20)}%;height:10px"></div>
      </div>
    </div>`;
  }
  return html;
}

/** Generate a skeleton table */
export function skeletonTable(rows = 5, cols = 4) {
  let html = '<div class="skeleton-table">';
  html += '<div class="skeleton-table-header">';
  for (let c = 0; c < cols; c++) {
    html += `<div class="skeleton-line" style="width:${60 + Math.floor(Math.random() * 30)}%;height:12px"></div>`;
  }
  html += '</div>';
  for (let r = 0; r < rows; r++) {
    html += '<div class="skeleton-table-row">';
    for (let c = 0; c < cols; c++) {
      html += `<div class="skeleton-line" style="width:${40 + Math.floor(Math.random() * 50)}%;height:14px"></div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

/** Loading spinner with message */
export function loadingSpinner(msg = 'Lade Daten...') {
  return `<div class="loading-wrap"><div class="spinner"></div>${msg}</div>`;
}
