// stock_snapshot_view.js — 순수 표시 helper. ES5(index 호환).
function _ssvFmt(n) { return (n === null || n === undefined) ? "—" : Number(n).toLocaleString("ko-KR"); }
function ssvAgeDays(stockDate, todayStr) {
  var a = Date.parse(stockDate + "T00:00:00Z"), b = Date.parse(todayStr + "T00:00:00Z");
  return (isNaN(a) || isNaN(b)) ? null : Math.round((b - a) / 86400000);
}
function _ssvSectionsValid(sections, total) {
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) return false;
  var keys = ['beef', 'jadan', 'incu', 'special', 'breeding'], sum = 0;
  for (var i = 0; i < keys.length; i++) {
    var value = sections[keys[i]];
    if (typeof value !== 'number' || !isFinite(value) || value < 0 ||
        Math.floor(value) !== value || value > 9007199254740991) return false;
    sum += value;
  }
  return sum <= 9007199254740991 && sum === total;
}
function stockSnapshotView(p, ledgerField, todayStr) {
  var s = (p && p.stock_snapshot) || null, ledger = p ? p[ledgerField] : null;
  // The representative-approved physical baseline is canonical when the old ledger API has no snapshot block.
  // Never invent history, silently accept an invalid API block, or promote the unreconciled ledger count.
  if (!s && typeof DOBANG_APPROVED_PHYSICAL_BASIS !== 'undefined') {
    var b = DOBANG_APPROVED_PHYSICAL_BASIS, bs = b && b.stock_snapshot;
    var sd = bs && bs.stock_date;
    var td = Date.parse(todayStr + 'T00:00:00Z'), bd = Date.parse(sd + 'T00:00:00Z');
    if (b && b.schema === 'dobang-approved-physical-stock-basis-v1' && b.approved_primary_basis === true &&
        /^[0-9a-f]{64}$/.test(b.source_snapshot_sha256 || '') &&
        typeof sd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sd) &&
        Number.isFinite(td) && Number.isFinite(bd) && bd <= td &&
        new Date(bd).toISOString().slice(0,10) === sd && (!p || !p.date || p.date === todayStr)) {
      s = JSON.parse(JSON.stringify(bs));
      s.ledger_total = ledger;
      s.age_days = Math.floor((td - bd) / 86400000);
      s.age_warning = '대표 제공 기준일 ' + sd + ' (' + s.age_days + '일 경과) — 실측일시 미확인. 오늘 실측이나 실시간 두수가 아닙니다.';
    }
  }
  if (!s) return { total: null, sections: null, label: '실사 기준자료 미확인',
                   ledgerNote: '정리 전 원장 ' + _ssvFmt(ledger) + '두(부정확·현재 두수 기준 제외)',
                   delta: null, deltaText: '실사 기준 연결 전 — 장부값으로 대체하지 않음', warn: '승인된 실사 기준자료 확인 필요' };
  var ledgerNote = "정리 전 원장 " + _ssvFmt(s.ledger_total) + "두(부정확·실사 아님·현재 두수 기준 제외)";
  var inactiveStatuses = ['snapshot_invalid', 'not_applied_non_today', 'not_applied_invalid_date'];
  if ((s.applied !== true && s.applied !== false) ||
      (s.applied === true && s.status !== 'applied') ||
      (s.applied === false && inactiveStatuses.indexOf(s.status) === -1)) {
    return { total: null, sections: null, label: '실사 상태 검증 실패 — 원장값으로 대체하지 않음',
             ledgerNote: ledgerNote, delta: null, deltaText: '비교보류', warn: '실사 적용 상태 확인 필요' };
  }
  if (s.applied === true) {
    var age = ssvAgeDays(s.stock_date, todayStr);  // 정적 JSON 생성일과 열람일 차이 보정
    if (typeof s.physical_total !== 'number' || !isFinite(s.physical_total) ||
        Math.floor(s.physical_total) !== s.physical_total || s.physical_total < 0 ||
        !_ssvSectionsValid(s.physical_sections, s.physical_total) || age === null || age < 0) {
      return { total: null, sections: null, label: '실사값 검증 실패 — 원장값으로 대체하지 않음',
               ledgerNote: ledgerNote, delta: null, deltaText: '비교보류', warn: '실사 합계 또는 기준일 확인 필요' };
    }
    return { total: s.physical_total, sections: s.physical_sections, label: s.display_label, ledgerNote: ledgerNote,
             delta: null, deltaText: "실사↔장부 비교보류",
             warn: "대표 제공 기준일 " + s.stock_date + " (" + age + "일 경과) — 실측일시 미확인 · 오늘 실측 아님" };
  }
  if (s.status === "snapshot_invalid")
    return { total: null, sections: null, label: s.display_label, ledgerNote: ledgerNote,
             delta: null, deltaText: "비교보류", warn: "오류: " + (s.errors || []).join(",") };
  return { total: ledger, sections: null, label: s.display_label, ledgerNote: "",
           delta: p.delta, deltaText: null, warn: "" };  // 과거일·날짜오류 조회: legacy 그대로
}
if (typeof module !== "undefined") module.exports = { stockSnapshotView: stockSnapshotView, ssvAgeDays: ssvAgeDays };
