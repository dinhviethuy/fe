import React, { useCallback, useRef, useState, useEffect } from 'react';
import type { TableItem } from '../types';
import { getTableColCount } from '../types';

interface TableEditorProps {
  tables: TableItem[];
  onTablesChange: (tables: TableItem[]) => void;
}

const TableEditor: React.FC<TableEditorProps> = ({ tables, onTablesChange }) => {
  const [dragState, setDragState] = useState<{
    tableIndex: number;
    fromRow: number; // Chỉ số hàng trong table.rows
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    tableIndex: number;
    position: number; // Vị trí chèn trước trong table.rows
  } | null>(null);

  // Trạng thái cho chế độ chọn vùng để gộp ô/bôi màu header (mặc định luôn bật)
  const [selectMode, setSelectMode] = useState<{
    tableIndex: number;
    start: { r: number; c: number } | null;
    end: { r: number; c: number } | null;
    isDragging: boolean;
  } | null>(null);

  // Ô đang được nháy đúp chuột để chỉnh sửa văn bản
  const [focusedCell, setFocusedCell] = useState<{
    tableIndex: number;
    r: number;
    c: number;
  } | null>(null);

  const dragRowRef = useRef<number>(-1);

  const updateTable = useCallback(
    (tableIndex: number, updater: (table: TableItem) => TableItem) => {
      const newTables = tables.map((t, i) => (i === tableIndex ? updater({ ...t }) : t));
      onTablesChange(newTables);
    },
    [tables, onTablesChange]
  );

  const handleTableNameChange = (tableIndex: number, name: string) => {
    updateTable(tableIndex, (t) => ({ ...t, tableName: name }));
  };

  const handleCellChange = (tableIndex: number, rowIndex: number, colIndex: number, value: string) => {
    updateTable(tableIndex, (t) => {
      const newRows = t.rows.map((r) => [...r]);
      newRows[rowIndex][colIndex] = value;
      return { ...t, rows: newRows };
    });
  };

  // Hàm bôi màu Header cho các dòng được chọn
  const colorAsHeader = (tableIndex: number, startR: number, endR: number) => {
    updateTable(tableIndex, (t) => {
      const headerRows = t.headerRows ? [...t.headerRows] : [];
      for (let r = startR; r <= endR; r++) {
        if (!headerRows.includes(r)) {
          headerRows.push(r);
        }
      }
      return { ...t, headerRows };
    });
  };

  // Hàm hủy bôi màu Header cho các dòng được chọn
  const uncolorHeader = (tableIndex: number, startR: number, endR: number) => {
    updateTable(tableIndex, (t) => {
      const headerRows = t.headerRows ? [...t.headerRows] : [];
      const newHeaderRows = headerRows.filter((r) => r < startR || r > endR);
      return { ...t, headerRows: newHeaderRows };
    });
  };

  // Hàm chèn hàng hoạt động trên chỉ số hàng trong table.rows
  const insertRowAt = (tableIndex: number, position: number) => {
    updateTable(tableIndex, (t) => {
      const newRows = [...t.rows];
      const emptyRow = new Array(getTableColCount(t)).fill('');
      newRows.splice(position, 0, emptyRow);

      // Dịch chuyển chỉ số các hàng header ở phía sau
      let headerRows = t.headerRows ? [...t.headerRows] : [];
      headerRows = headerRows.map((r) => (r >= position ? r + 1 : r));

      // Dịch chuyển merges
      const newMerges = t.merges?.map((merge) => {
        let { startRow, endRow } = merge;
        if (startRow >= position) startRow += 1;
        if (endRow >= position) endRow += 1;
        return { ...merge, startRow, endRow };
      });

      return { ...t, rows: newRows, headerRows, merges: newMerges };
    });
  };

  // Hàm xóa hàng hoạt động trên chỉ số hàng trong table.rows
  const deleteRow = (tableIndex: number, rowIndex: number) => {
    updateTable(tableIndex, (t) => {
      if (t.rows.length <= 1) return t; // Giữ lại ít nhất 1 hàng

      const newRows = [...t.rows];
      newRows.splice(rowIndex, 1);

      // Cập nhật danh sách hàng header sau khi xóa
      let headerRows = t.headerRows ? [...t.headerRows] : [];
      headerRows = headerRows
        .filter((r) => r !== rowIndex)
        .map((r) => (r > rowIndex ? r - 1 : r));

      // Dịch chuyển merges
      const newMerges = t.merges
        ?.map((merge) => {
          let { startRow, endRow } = merge;
          if (startRow === rowIndex && endRow === rowIndex) {
            return null;
          }
          if (startRow > rowIndex) startRow -= 1;
          if (endRow > rowIndex) endRow -= 1;
          return { ...merge, startRow, endRow };
        })
        .filter((m): m is any => m !== null && (m.startRow !== m.endRow || m.startCol !== m.endCol));

      return { ...t, rows: newRows, headerRows, merges: newMerges };
    });
  };

  const addRow = (tableIndex: number) => {
    updateTable(tableIndex, (t) => {
      const emptyRow = new Array(getTableColCount(t)).fill('');
      return { ...t, rows: [...t.rows, emptyRow] };
    });
  };

  const addColumn = (tableIndex: number) => {
    updateTable(tableIndex, (t) => {
      const newRows = t.rows.map((r) => [...r, '']);
      return {
        ...t,
        rows: newRows,
      };
    });
  };

  const insertColumnAt = (tableIndex: number, colIndex: number) => {
    updateTable(tableIndex, (t) => {
      const newRows = t.rows.map((row) => {
        const newRow = [...row];
        newRow.splice(colIndex, 0, '');
        return newRow;
      });
      const newMerges = t.merges?.map((merge) => {
        let { startCol, endCol } = merge;
        if (startCol >= colIndex) startCol += 1;
        if (endCol >= colIndex) endCol += 1;
        return { ...merge, startCol, endCol };
      });
      return {
        ...t,
        rows: newRows,
        merges: newMerges,
      };
    });
  };

  const deleteColumn = (tableIndex: number, colIndex: number) => {
    updateTable(tableIndex, (t) => {
      const newRows = t.rows.map((r) => r.filter((_, i) => i !== colIndex));
      const newMerges = t.merges
        ?.map((merge) => {
          let { startCol, endCol } = merge;
          if (startCol === colIndex && endCol === colIndex) {
            return null;
          }
          if (startCol > colIndex) startCol -= 1;
          if (endCol > colIndex) endCol -= 1;
          return { ...merge, startCol, endCol };
        })
        .filter((m): m is any => m !== null && (m.startRow !== m.endRow || m.startCol !== m.endCol));

      return {
        ...t,
        rows: newRows,
        merges: newMerges,
      };
    });
  };

  const deleteTable = (tableIndex: number) => {
    const newTables = tables.filter((_, i) => i !== tableIndex);
    onTablesChange(newTables);
  };

  const mergeWithAbove = (tableIndex: number) => {
    if (tableIndex <= 0) return;
    const targetTable = { ...tables[tableIndex - 1] };
    const sourceTable = tables[tableIndex];

    const newRows = targetTable.rows.map((row) => [...row]);
    const sourceHeaderRows = sourceTable.headerRows || [];

    // Gộp toàn bộ dòng của bảng dưới vào bảng trên
    const colCountA = getTableColCount(targetTable);
    const colCountB = getTableColCount(sourceTable);
    const maxCols = Math.max(colCountA, colCountB);

    // Chuẩn hóa cột cho các dòng bảng trên
    const alignedRowsA = newRows.map((row) => {
      const newRow = [...row];
      while (newRow.length < maxCols) newRow.push('');
      return newRow;
    });

    // Chuẩn hóa cột cho các dòng bảng dưới
    const alignedRowsB = sourceTable.rows.map((row) => {
      const newRow = [...row];
      while (newRow.length < maxCols) newRow.push('');
      return newRow;
    });

    const offsetRowIndex = alignedRowsA.length;

    // Cập nhật lại các dòng header mới
    const targetHeaderRows = targetTable.headerRows ? [...targetTable.headerRows] : [];
    sourceHeaderRows.forEach((r) => {
      targetHeaderRows.push(r + offsetRowIndex);
    });

    // Ánh xạ merges của bảng nguồn
    const shiftedMergesB = (sourceTable.merges || []).map((m) => ({
      ...m,
      startRow: m.startRow + offsetRowIndex,
      endRow: m.endRow + offsetRowIndex,
    }));

    const mergedTable: TableItem = {
      tableName: targetTable.tableName || `Bảng ${tableIndex}`,
      headers: [],
      rows: [...alignedRowsA, ...alignedRowsB],
      headerRows: targetHeaderRows,
      merges: [...(targetTable.merges || []), ...shiftedMergesB],
    };

    const newTables = [...tables];
    newTables[tableIndex - 1] = mergedTable;
    newTables.splice(tableIndex, 1);

    onTablesChange(newTables);
  };

  const splitTableAt = (tableIndex: number, rowIndex: number) => {
    if (rowIndex <= 0 || rowIndex >= tables[tableIndex].rows.length) return;

    const originalTable = tables[tableIndex];
    const tableName = originalTable.tableName || `Bảng ${tableIndex + 1}`;

    const mergesA = originalTable.merges?.filter((m) => m.endRow < rowIndex) || [];
    const mergesB = originalTable.merges
      ?.filter((m) => m.startRow >= rowIndex)
      .map((m) => ({
        ...m,
        startRow: m.startRow - rowIndex,
        endRow: m.endRow - rowIndex,
      })) || [];

    const headerRowsA = (originalTable.headerRows || []).filter((r) => r < rowIndex);
    const headerRowsB = (originalTable.headerRows || [])
      .filter((r) => r >= rowIndex)
      .map((r) => r - rowIndex);

    const tableA: TableItem = {
      tableName: `${tableName} - Phần 1`,
      headers: [],
      rows: originalTable.rows.slice(0, rowIndex),
      headerRows: headerRowsA,
      merges: mergesA,
    };

    const tableB: TableItem = {
      tableName: `${tableName} - Phần 2`,
      headers: [],
      rows: originalTable.rows.slice(rowIndex),
      headerRows: headerRowsB,
      merges: mergesB,
    };

    const newTables = [...tables];
    newTables.splice(tableIndex, 1, tableA, tableB);

    onTablesChange(newTables);
  };

  // ===== Drag & Drop (Kéo thả di chuyển hàng) =====
  const handleDragStart = (tableIndex: number, rowIndex: number) => {
    dragRowRef.current = rowIndex;
    setDragState({ tableIndex, fromRow: rowIndex });
  };

  const handleDragOver = (e: React.DragEvent, tableIndex: number, rowIndex: number) => {
    e.preventDefault();
    if (!dragState || dragState.tableIndex !== tableIndex) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? rowIndex : rowIndex + 1;

    setDropTarget({ tableIndex, position });
  };

  const shiftRowIndex = (r: number, from: number, to: number) => {
    if (r === from) return to;
    if (from < to) {
      if (r > from && r <= to) return r - 1;
    } else {
      if (r >= to && r < from) return r + 1;
    }
    return r;
  };

  const handleDragEnd = () => {
    if (dragState && dropTarget && dragState.tableIndex === dropTarget.tableIndex) {
      const { tableIndex, fromRow } = dragState;
      let { position } = dropTarget;

      if (position !== fromRow && position !== fromRow + 1) {
        updateTable(tableIndex, (t) => {
          const combined = [...t.rows];
          const [movedRow] = combined.splice(fromRow, 1);
          if (fromRow < position) {
            position--;
          }
          combined.splice(position, 0, movedRow);

          // Cập nhật headerRows
          const headerRows = t.headerRows?.map((r) => shiftRowIndex(r, fromRow, position));

          // Cập nhật merges
          const newMerges = t.merges?.map((merge) => {
            const startRow = shiftRowIndex(merge.startRow, fromRow, position);
            const endRow = shiftRowIndex(merge.endRow, fromRow, position);
            return {
              ...merge,
              startRow: Math.min(startRow, endRow),
              endRow: Math.max(startRow, endRow),
            };
          });

          return { ...t, rows: combined, headerRows, merges: newMerges };
        });
      }
    }

    setDragState(null);
    setDropTarget(null);
    dragRowRef.current = -1;
  };

  // ===== Kéo chọn ô gộp =====
  const handleCellMouseDown = (tableIndex: number, r: number, c: number) => {
    if (focusedCell && focusedCell.tableIndex === tableIndex && focusedCell.r === r && focusedCell.c === c) {
      return;
    }
    setFocusedCell(null);
    setSelectMode({
      tableIndex,
      start: { r, c },
      end: { r, c },
      isDragging: true,
    });
  };

  const handleCellMouseEnter = (tableIndex: number, r: number, c: number) => {
    if (!selectMode || selectMode.tableIndex !== tableIndex || !selectMode.isDragging || selectMode.start === null) return;
    setSelectMode((prev) => {
      if (!prev || prev.start === null) return prev;
      return {
        ...prev,
        end: { r, c },
      };
    });
  };

  useEffect(() => {
    if (selectMode?.isDragging) {
      const handleGlobalMouseUp = () => {
        setSelectMode((prev) => {
          if (!prev || !prev.isDragging) return prev;
          return { ...prev, isDragging: false };
        });
      };
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [selectMode?.isDragging]);

  const isCellSelected = (tableIndex: number, r: number, c: number) => {
    if (!selectMode || selectMode.tableIndex !== tableIndex || selectMode.start === null || selectMode.end === null)
      return false;
    const minR = Math.min(selectMode.start.r, selectMode.end.r);
    const maxR = Math.max(selectMode.start.r, selectMode.end.r);
    const minC = Math.min(selectMode.start.c, selectMode.end.c);
    const maxC = Math.max(selectMode.start.c, selectMode.end.c);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  };

  const hasMergeRangeUnderSelection = (tableIndex: number) => {
    if (!selectMode || selectMode.start === null || selectMode.end === null) return false;
    const startRow = Math.min(selectMode.start.r, selectMode.end.r);
    const endRow = Math.max(selectMode.start.r, selectMode.end.r);
    const startCol = Math.min(selectMode.start.c, selectMode.end.c);
    const endCol = Math.max(selectMode.start.c, selectMode.end.c);

    const table = tables[tableIndex];
    return (
      table.merges?.some((merge) => {
        const overlapRow = Math.max(merge.startRow, startRow) <= Math.min(merge.endRow, endRow);
        const overlapCol = Math.max(merge.startCol, startCol) <= Math.min(merge.endCol, endCol);
        return overlapRow && overlapCol;
      }) || false
    );
  };

  const confirmMerge = (tableIndex: number) => {
    if (!selectMode || !selectMode.start || !selectMode.end) return;
    const startRow = Math.min(selectMode.start.r, selectMode.end.r);
    const endRow = Math.max(selectMode.start.r, selectMode.end.r);
    const startCol = Math.min(selectMode.start.c, selectMode.end.c);
    const endCol = Math.max(selectMode.start.c, selectMode.end.c);

    if (startRow === endRow && startCol === endCol) return;

    updateTable(tableIndex, (t) => {
      const newMerges = [...(t.merges || [])];
      
      const cleanMerges = newMerges.filter((merge) => {
        const overlapRow = Math.max(merge.startRow, startRow) <= Math.min(merge.endRow, endRow);
        const overlapCol = Math.max(merge.startCol, startCol) <= Math.min(merge.endCol, endCol);
        return !(overlapRow && overlapCol);
      });

      cleanMerges.push({ startRow, startCol, endRow, endCol });

      const newRows = t.rows.map((row, rIdx) => {
        return row.map((cell, cIdx) => {
          if (rIdx >= startRow && rIdx <= endRow && cIdx >= startCol && cIdx <= endCol) {
            if (rIdx === startRow && cIdx === startCol) return cell;
            return '';
          }
          return cell;
        });
      });

      return { ...t, rows: newRows, merges: cleanMerges };
    });

    setSelectMode(null);
  };

  const confirmUnmerge = (tableIndex: number) => {
    if (!selectMode || !selectMode.start || !selectMode.end) return;
    const startRow = Math.min(selectMode.start.r, selectMode.end.r);
    const endRow = Math.max(selectMode.start.r, selectMode.end.r);
    const startCol = Math.min(selectMode.start.c, selectMode.end.c);
    const endCol = Math.max(selectMode.start.c, selectMode.end.c);

    updateTable(tableIndex, (t) => {
      const newMerges = t.merges?.filter((merge) => {
        const overlapRow = Math.max(merge.startRow, startRow) <= Math.min(merge.endRow, endRow);
        const overlapCol = Math.max(merge.startCol, startCol) <= Math.min(merge.endCol, endCol);
        return !(overlapRow && overlapCol);
      }) || [];
      return { ...t, merges: newMerges };
    });

    setSelectMode(null);
  };

  if (tables.length === 0) {
    return (
      <div className="no-table-message">
        <span>📋</span>
        <h3>Không tìm thấy bảng dữ liệu</h3>
        <p>Tài liệu này không chứa bảng dữ liệu nào có thể trích xuất.</p>
      </div>
    );
  }

  return (
    <div>
      {tables.map((table, tableIndex) => {
        const colCount = getTableColCount(table);
        const R_total = table.rows.length;
        const C_total = colCount;

        const mergeMap = Array.from({ length: R_total }, () =>
          Array.from({ length: C_total }, () => ({
            rowspan: 1,
            colspan: 1,
            isHidden: false,
          }))
        );

        if (table.merges) {
          table.merges.forEach((merge) => {
            const { startRow, startCol, endRow, endCol } = merge;
            if (
              startRow >= 0 && startRow < R_total &&
              endRow >= 0 && endRow < R_total &&
              startCol >= 0 && startCol < C_total &&
              endCol >= 0 && endCol < C_total
            ) {
              for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                  if (r === startRow && c === startCol) {
                    mergeMap[r][c].rowspan = endRow - startRow + 1;
                    mergeMap[r][c].colspan = endCol - startCol + 1;
                  } else {
                    mergeMap[r][c].isHidden = true;
                  }
                }
              }
            }
          });
        }

        const showToolbar = !!(
          selectMode &&
          selectMode.tableIndex === tableIndex &&
          selectMode.start &&
          selectMode.end &&
          (selectMode.start.r !== selectMode.end.r ||
            selectMode.start.c !== selectMode.end.c ||
            hasMergeRangeUnderSelection(tableIndex))
        );

        const isCurrentlySelecting = !!(selectMode && selectMode.tableIndex === tableIndex && selectMode.start && selectMode.end);

        return (
          <div key={tableIndex} className="table-group">
            <div className="table-group-header">
              <input
                className="table-name-input"
                value={table.tableName || ''}
                onChange={(e) => handleTableNameChange(tableIndex, e.target.value)}
                placeholder={`Bảng ${tableIndex + 1}`}
              />
              <div className="table-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '4px' }}>
                  💡 Nhấp đúp để sửa ô
                </span>
                {tableIndex > 0 && (
                  <button
                    className="add-col-btn"
                    onClick={() => mergeWithAbove(tableIndex)}
                    title="Gộp bảng này vào bảng phía trên"
                    style={{ background: 'rgba(74, 108, 247, 0.1)', color: 'var(--accent-blue-light)' }}
                  >
                    🔗 Gộp với bảng trên
                  </button>
                )}
                <button
                  className="add-col-btn"
                  onClick={() => addColumn(tableIndex)}
                  title="Thêm cột"
                >
                  + Thêm cột
                </button>
                <button
                  className="delete-table-btn"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Bạn có chắc chắn muốn xóa toàn bộ "${
                          table.tableName || `Bảng ${tableIndex + 1}`
                        }" không?`
                      )
                    ) {
                      deleteTable(tableIndex);
                    }
                  }}
                  title="Xóa toàn bộ bảng này"
                >
                  🗑️ Xóa bảng
                </button>
              </div>
            </div>

            {/* Thanh công cụ khi kéo chọn ô */}
            {showToolbar && selectMode && (
              <div className="select-mode-bar" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                background: 'rgba(74, 108, 247, 0.08)',
                border: '1px solid rgba(74, 108, 247, 0.3)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '12px',
                fontSize: '13px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📋 <b>Vùng đang chọn:</b></span>
                  {selectMode.start && selectMode.end && (
                    <span>
                      dòng {Math.min(selectMode.start.r, selectMode.end.r) + 1}
                      {Math.max(selectMode.start.r, selectMode.end.r) !== Math.min(selectMode.start.r, selectMode.end.r) && 
                        ` - ${Math.max(selectMode.start.r, selectMode.end.r) + 1}`}, 
                      cột {Math.min(selectMode.start.c, selectMode.end.c) + 1}
                      {Math.max(selectMode.start.c, selectMode.end.c) !== Math.min(selectMode.start.c, selectMode.end.c) && 
                        ` - ${Math.max(selectMode.start.c, selectMode.end.c) + 1}`}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectMode.start && selectMode.end && (
                    <>
                      {(selectMode.start.r !== selectMode.end.r || selectMode.start.c !== selectMode.end.c) && (
                        <button
                          className="mini-btn add"
                          onClick={() => confirmMerge(tableIndex)}
                          style={{ height: '28px', padding: '0 12px', fontSize: '12px', width: 'auto' }}
                        >
                          🔗 Gộp ô chọn
                        </button>
                      )}
                      {hasMergeRangeUnderSelection(tableIndex) && (
                        <button
                          className="mini-btn"
                          onClick={() => confirmUnmerge(tableIndex)}
                          style={{ height: '28px', padding: '0 12px', fontSize: '12px', width: 'auto', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-orange)' }}
                        >
                          🔓 Rã ô (Hủy gộp)
                        </button>
                      )}
                      <button
                        className="mini-btn add"
                        onClick={() => {
                          const minR = Math.min(selectMode.start!.r, selectMode.end!.r);
                          const maxR = Math.max(selectMode.start!.r, selectMode.end!.r);
                          colorAsHeader(tableIndex, minR, maxR);
                          setSelectMode(null);
                        }}
                        style={{ height: '28px', padding: '0 12px', fontSize: '12px', width: 'auto', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue-light)' }}
                        title="Bôi màu Header cho các dòng đang chọn"
                      >
                        🎨 Bôi màu Header
                      </button>
                      <button
                        className="mini-btn"
                        onClick={() => {
                          const minR = Math.min(selectMode.start!.r, selectMode.end!.r);
                          const maxR = Math.max(selectMode.start!.r, selectMode.end!.r);
                          uncolorHeader(tableIndex, minR, maxR);
                          setSelectMode(null);
                        }}
                        style={{ height: '28px', padding: '0 12px', fontSize: '12px', width: 'auto', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)' }}
                        title="Hủy màu Header cho các dòng đang chọn"
                      >
                        🚫 Hủy màu Header
                      </button>
                    </>
                  )}
                  <button
                    className="mini-btn"
                    onClick={() => setSelectMode(null)}
                    style={{ height: '28px', padding: '0 12px', fontSize: '12px', width: 'auto', background: 'var(--bg-glass)', color: 'var(--text-secondary)' }}
                  >
                    Hủy chọn
                  </button>
                </div>
              </div>
            )}

            <div className="table-container">
              <table className="data-table select-mode-active">
                <thead>
                  {/* Dòng chữ cái cột A, B, C... giống Excel */}
                  <tr className="editor-col-header-row" style={{ background: '#161b22' }}>
                    <th className="editor-corner-cell" style={{ width: '32px', minWidth: '32px', background: '#161b22', borderBottom: '1px solid var(--border-glass-strong)', borderRight: '1px solid var(--border-glass-strong)' }}></th>
                    {Array.from({ length: colCount }).map((_, colIndex) => (
                      <th
                        key={colIndex}
                        className="editor-col-header"
                        style={{
                          padding: '6px 8px',
                          textAlign: 'center',
                          color: 'var(--text-muted)',
                          fontWeight: '600',
                          fontSize: '11px',
                          background: '#161b22',
                          borderRight: '1px solid var(--border-glass-strong)',
                          borderBottom: '1px solid var(--border-glass-strong)',
                          minWidth: '160px',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <span>{getColumnLetter(colIndex)}</span>
                          <div className="col-letter-actions" style={{ display: 'flex', gap: '2px' }}>
                            <button
                              className="mini-btn add"
                              onClick={(e) => {
                                e.stopPropagation();
                                insertColumnAt(tableIndex, colIndex);
                              }}
                              title="Chèn cột bên trái"
                              style={{ width: '18px', height: '18px', fontSize: '9px', padding: 0 }}
                            >
                              ⇠
                            </button>
                            <button
                              className="mini-btn add"
                              onClick={(e) => {
                                e.stopPropagation();
                                insertColumnAt(tableIndex, colIndex + 1);
                              }}
                              title="Chèn cột bên phải"
                              style={{ width: '18px', height: '18px', fontSize: '9px', padding: 0 }}
                            >
                              ⇢
                            </button>
                            <button
                              className="mini-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteColumn(tableIndex, colIndex);
                              }}
                              title="Xóa cột"
                              style={{ width: '18px', height: '18px', fontSize: '9px', padding: 0 }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </th>
                    ))}
                    <th style={{ width: '90px', background: 'transparent', border: 'none' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rowIndex) => {
                    const isHeader = !!(table.headerRows?.includes(rowIndex));
                    return (
                      <React.Fragment key={rowIndex}>
                        {/* Drop indicator line BEFORE this row */}
                        {dropTarget &&
                          dropTarget.tableIndex === tableIndex &&
                          dropTarget.position === rowIndex &&
                          dragState?.fromRow !== rowIndex &&
                          dragState?.fromRow !== rowIndex - 1 && (
                            <tr className="drop-indicator-row">
                              <td colSpan={colCount + 2}>
                                <div className="drop-indicator-line" />
                              </td>
                            </tr>
                          )}

                        <tr
                          className={`${
                            dragState?.tableIndex === tableIndex && dragState.fromRow === rowIndex
                              ? 'dragging-row'
                              : ''
                          }`}
                          onDragOver={(e) => handleDragOver(e, tableIndex, rowIndex)}
                        >
                          {/* Drag handle / Row number */}
                          <td
                            className="drag-handle-cell"
                            draggable={!isCurrentlySelecting}
                            onDragStart={() => handleDragStart(tableIndex, rowIndex)}
                            onDragEnd={handleDragEnd}
                            style={{
                              textAlign: 'center',
                              color: 'var(--text-muted)',
                              fontSize: '11px',
                              fontWeight: '500',
                              background: '#161b22',
                              borderRight: '1px solid var(--border-glass-strong)',
                              borderBottom: '1px solid var(--border-glass-strong)',
                              width: '32px',
                              minWidth: '32px',
                              userSelect: 'none',
                              verticalAlign: 'middle',
                              position: 'relative',
                              padding: 0,
                              cursor: isCurrentlySelecting ? 'default' : 'grab'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '4px 0' }}>
                              {!isCurrentlySelecting && (
                                <div className="drag-handle" style={{ cursor: 'grab', fontSize: '10px', lineHeight: 1 }} title="Kéo để di chuyển hàng">⠿</div>
                              )}
                              <span>{rowIndex + 1}</span>
                            </div>
                          </td>

                          {row.map((cell, colIndex) => {
                            const mergeInfo = mergeMap[rowIndex]?.[colIndex] || { rowspan: 1, colspan: 1, isHidden: false };
                            if (mergeInfo.isHidden) return null;

                            const selected = isCellSelected(tableIndex, rowIndex, colIndex);
                            const isFocused = !!(focusedCell && focusedCell.tableIndex === tableIndex && focusedCell.r === rowIndex && focusedCell.c === colIndex);

                            return (
                              <td
                                key={colIndex}
                                rowSpan={mergeInfo.rowspan}
                                colSpan={mergeInfo.colspan}
                                onMouseDown={() => handleCellMouseDown(tableIndex, rowIndex, colIndex)}
                                onMouseEnter={() => handleCellMouseEnter(tableIndex, rowIndex, colIndex)}
                                onDoubleClick={() => setFocusedCell({ tableIndex, r: rowIndex, c: colIndex })}
                                className={selected ? 'cell-selected' : ''}
                                style={{
                                  cursor: isFocused ? 'text' : 'cell',
                                  backgroundColor: selected 
                                    ? 'rgba(74, 108, 247, 0.15)' 
                                    : isHeader 
                                      ? 'rgba(74, 108, 247, 0.06)' 
                                      : undefined,
                                  outline: selected ? '2px solid var(--accent-blue)' : undefined,
                                  zIndex: selected ? 10 : undefined,
                                  borderRight: '1px solid var(--border-glass-strong)',
                                  borderBottom: '1px solid var(--border-glass-strong)',
                                  padding: 0,
                                }}
                              >
                                <input
                                  value={cell}
                                  onChange={(e) =>
                                    handleCellChange(tableIndex, rowIndex, colIndex, e.target.value)
                                  }
                                  readOnly={!isFocused}
                                  autoFocus={isFocused}
                                  onBlur={() => setFocusedCell(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === 'Escape') {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  style={{
                                    pointerEvents: isFocused ? 'auto' : 'none',
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: isHeader ? 'var(--accent-blue-light)' : 'var(--text-primary)',
                                    fontWeight: isHeader ? '600' : 'normal',
                                    fontSize: '13px',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                    textAlign: isHeader ? 'center' : 'left',
                                  }}
                                />
                              </td>
                            );
                          })}
                          <td style={{ border: 'none', background: 'transparent' }}>
                            <div className="row-actions">
                              {rowIndex > 0 && (
                                <button
                                  className="mini-btn split"
                                  onClick={() => splitTableAt(tableIndex, rowIndex)}
                                  title="Tách bảng từ dòng này"
                                >
                                  ✂️
                                </button>
                              )}
                              <button
                                  className="mini-btn add"
                                  onClick={() => insertRowAt(tableIndex, rowIndex + 1)}
                                  title="Chèn hàng bên dưới"
                                >
                                  +
                              </button>
                              <button
                                className="mini-btn"
                                onClick={() => deleteRow(tableIndex, rowIndex)}
                                title="Xóa hàng"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Drop indicator AFTER last row */}
                        {dropTarget &&
                          dropTarget.tableIndex === tableIndex &&
                          dropTarget.position === rowIndex + 1 &&
                          rowIndex === table.rows.length - 1 &&
                          dragState?.fromRow !== rowIndex && (
                            <tr className="drop-indicator-row">
                              <td colSpan={colCount + 2}>
                                <div className="drop-indicator-line" />
                              </td>
                            </tr>
                          )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button className="add-row-btn" onClick={() => addRow(tableIndex)}>
              + Thêm hàng mới
            </button>
          </div>
        );
      })}
    </div>
  );
};

function getColumnLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export default TableEditor;
