import { resources } from './resources';

figma.showUI(__html__, { width: 700, height: 520 });

// 상태 관리
let currentTextIds = new Set<string>();

// 텍스트 노드 ID → 하이라이트 사각형 ID 매핑 (인스턴스 노드는 setPluginData 불가하므로 별도 관리)
const highlightMap = new Map<string, string>();

// 초기화 및 상태 로드 (UI가 준비되면 호출)
async function loadSettings() {
  console.log('Code: loadSettings called');
  
  // 1. Send File & User Info (Immediate)
  const fileKey = figma.fileKey || '';
  const fileName = figma.root.name || 'Untitled';
  
  // currentUser 접근 시 권한 오류 방지 (manifest.json에 permissions: ["currentuser"] 필요)
  let currentUser = null;
  try {
    currentUser = figma.currentUser;
    console.log('Code: currentUser =', currentUser ? currentUser.name : 'null');
  } catch (e) {
    console.warn('Code: Cannot access currentUser (permission not granted)', e);
  }

  const userPayload = currentUser ? { name: currentUser.name, id: currentUser.id } : null;
  console.log('Code: sending file-key, fileKey:', fileKey, 'fileName:', fileName, 'user:', userPayload);
  
  figma.ui.postMessage({ 
    type: 'load-file-key', 
    key: fileKey, 
    name: fileName,
    user: userPayload
  });

  // 2. Local Data: Load API Key & Slack URL (User-level, figma.clientStorage)
  // 항상 로드하고 UI로 전송 (빈 값도 전송)
  try {
    const apiKey = await figma.clientStorage.getAsync('openai_api_key');
    const slackUrl = await figma.clientStorage.getAsync('slack_webhook_url');
    const manualFileKey = await figma.clientStorage.getAsync('manual_file_key');

    console.log('Code: loaded local settings - apiKey:', !!apiKey, 'slackUrl:', !!slackUrl, 'manualFileKey:', !!manualFileKey);

    // 항상 전송 (빈 값이어도 UI에서 초기화 가능하도록)
    figma.ui.postMessage({ type: 'load-api-key', apiKey: apiKey || '' });
    figma.ui.postMessage({ type: 'load-slack-url', url: slackUrl || '' });
    figma.ui.postMessage({ type: 'load-manual-file-key', key: manualFileKey || '' });

  } catch (e) {
    console.error('Failed to load local settings', e);
    // 실패해도 빈 값 전송
    figma.ui.postMessage({ type: 'load-api-key', apiKey: '' });
    figma.ui.postMessage({ type: 'load-slack-url', url: '' });
    figma.ui.postMessage({ type: 'load-manual-file-key', key: '' });
  }

  // 3. Shared Data: Load from Document Root (Document-level, figma.root.getPluginData)
  const savedStateStr = figma.root.getPluginData('pluginState');
  console.log('Code: loaded pluginState from document, length:', savedStateStr ? savedStateStr.length : 0);
  
  const savedBatchResultsStr = figma.root.getPluginData('pluginBatchResults');
  const savedContextStr = figma.root.getPluginData('pluginBatchContext');

  if (savedStateStr && savedStateStr.length > 0) {
    try {
      const savedState = JSON.parse(savedStateStr);
      const itemCount = Array.isArray(savedState) ? savedState.length : 0;
      console.log('Code: parsing savedState success, items:', itemCount);
      
      // 상태 복원
      figma.ui.postMessage({ 
        type: 'restore-state', 
        data: savedState
      });
      
      // 재스캔 방지용 ID 복원
      if (Array.isArray(savedState)) {
        savedState.forEach((item: any) => {
          if (item.ids && Array.isArray(item.ids)) {
            item.ids.forEach((id: string) => currentTextIds.add(id));
          }
        });
      }
      
      if (itemCount > 0) {
        figma.notify(`✅ ${itemCount}개의 저장된 항목을 불러왔습니다.`);
      }
    } catch (e) {
      console.error('Failed to parse saved state', e);
      figma.notify('⚠️ 저장된 상태 파싱 실패', { error: true });
      figma.ui.postMessage({ type: 'restore-state', data: [] });
    }
  } else {
    console.log('Code: No saved state found in document.');
    // 빈 상태도 전송 (UI 초기화용)
    figma.ui.postMessage({ type: 'restore-state', data: [] });
  }

  if (savedBatchResultsStr) {
    try {
      const savedBatchResults = JSON.parse(savedBatchResultsStr);
      figma.ui.postMessage({
        type: 'restore-batch-results',
        data: savedBatchResults
      });
    } catch (e) {
      console.error('Failed to parse batch results', e);
    }
  }

  if (savedContextStr) {
    // Context is just a string
    figma.ui.postMessage({
      type: 'restore-batch-context',
      data: savedContextStr
    });
  }
  
  console.log('Code: loadSettings completed');
}

figma.ui.onmessage = (msg) => {
  // UI 준비 완료 신호 받으면 설정 로드
  if (msg.type === 'ui-ready') {
    console.log('Code: Received ui-ready');
    loadSettings();
  }

  // API Key 및 Settings 저장 (Local Data - User-level, figma.clientStorage)
  if (msg.type === 'save-api-key') {
    const value = msg.apiKey || '';
    console.log('Code: saving API key, length:', value.length);
    figma.clientStorage.setAsync('openai_api_key', value)
      .then(() => console.log('Code: API key saved successfully'))
      .catch(err => console.error('Code: Failed to save API key', err));
  }
  if (msg.type === 'save-slack-url') {
    const value = msg.url || '';
    console.log('Code: saving Slack URL, length:', value.length);
    figma.clientStorage.setAsync('slack_webhook_url', value)
      .then(() => console.log('Code: Slack URL saved successfully'))
      .catch(err => console.error('Code: Failed to save Slack URL', err));
  }
  if (msg.type === 'save-manual-file-key') {
    const value = msg.key || '';
    console.log('Code: saving manual file key:', value);
    figma.clientStorage.setAsync('manual_file_key', value)
      .then(() => console.log('Code: Manual file key saved successfully'))
      .catch(err => console.error('Code: Failed to save manual file key', err));
  }

  // 상태 저장 (Shared Data - Document-level, figma.root.setPluginData)
  if (msg.type === 'save-state') {
    const itemCount = Array.isArray(msg.data) ? msg.data.length : 0;
    console.log('Code: save-state received, items:', itemCount);
    
    try {
      const strData = JSON.stringify(msg.data || []);
      
      // 저장
      figma.root.setPluginData('pluginState', strData);
      
      // 저장 확인 (바로 읽어서 검증)
      const verifyData = figma.root.getPluginData('pluginState');
      const verified = verifyData === strData;
      console.log('Code: pluginState saved, size:', strData.length, 'verified:', verified);
      
      if (!verified) {
        console.error('Code: Save verification FAILED! Saved length:', strData.length, 'Read length:', verifyData?.length);
        figma.notify('⚠️ 상태 저장 검증 실패', { error: true });
      }
      
      // Update internal ID set to match saved state
      const newIds = new Set<string>();
      if (Array.isArray(msg.data)) {
        msg.data.forEach((item: any) => {
          if (item.ids && Array.isArray(item.ids)) {
            item.ids.forEach((id: string) => newIds.add(id));
          }
        });
      }
      console.log('Code: currentTextIds updated from', currentTextIds.size, 'to', newIds.size);
      currentTextIds = newIds;
    } catch (e) {
      console.error('Code: Failed to save state', e);
      figma.notify('⚠️ 상태 저장 실패: ' + (e as Error).message, { error: true });
    }
  }
  
  // 1. 특정 노드(들) 선택 및 포커스
  if (msg.type === 'focus-nodes') {
    const ids = msg.ids;
    const nodesToSelect: SceneNode[] = [];
    
    ids.forEach((id: string) => {
      const node = figma.getNodeById(id);
      if (node) nodesToSelect.push(node as SceneNode);
    });

    if (nodesToSelect.length > 0) {
      figma.currentPage.selection = nodesToSelect;
      figma.viewport.scrollAndZoomIntoView(nodesToSelect);
    }
  }

  // 1-1. 현재 선택된 노드를 목록에 추가 (Accumulate)
  if (msg.type === 'add-selection') {
    const selection = figma.currentPage.selection;
    const newTextNodes: TextNode[] = [];

    // 디버그: 선택된 노드 수와 타입 확인
    const selectionInfo = selection.map(n => `${n.type}:${n.id}`).join(', ');
    console.log('add-selection: selection =', selectionInfo, 'currentTextIds size =', currentTextIds.size);

    selection.forEach(node => {
      if (node.type === "TEXT") {
        // 이미 추출된 노드는 건너뛰기
        if (!currentTextIds.has(node.id)) {
          newTextNodes.push(node as TextNode);
        } else {
          console.log('Skipping already extracted:', node.id);
        }
      } 
      // 수동 추가 버튼을 눌렀을 때는 그룹/프레임 내부의 텍스트도 찾아냅니다.
      else if ("findAll" in node) {
        (node as FrameNode | GroupNode | ComponentNode).findAll((n) => n.type === "TEXT").forEach((textNode) => {
          // 이미 추출된 노드는 건너뛰기
          if (!currentTextIds.has(textNode.id)) {
            newTextNodes.push(textNode as TextNode);
          }
        });
      }
    });

    if (newTextNodes.length > 0) {
      const data = newTextNodes.map(node => ({
        ids: [node.id],
        text: node.characters
      }));
      
      // Send add-selection message to UI
      figma.ui.postMessage({ type: 'add-items', data });
      
      // Update internal ID set and Highlight
      newTextNodes.forEach(n => {
        currentTextIds.add(n.id);
        try {
          highlightNode(n); // 빨간 박스 표시
        } catch (e) {
          // 인스턴스 내부 노드는 하이라이트 생성이 실패할 수 있음 (무시)
        }
      });
      
      figma.notify(`${newTextNodes.length}개의 텍스트가 추가되었습니다.`);
    } else {
      figma.notify(`선택된 텍스트가 없습니다. (선택: ${selection.length}개, 이미 추출됨: ${currentTextIds.size}개)`);
    }
  }
  
  // 2. 체크박스 변경 시 선택 영역만 업데이트 (줌인 X)
  if (msg.type === 'update-selection') {
    const ids = msg.ids;
    const nodesToSelect: SceneNode[] = [];
    ids.forEach((id: string) => {
      const node = figma.getNodeById(id);
      if (node) nodesToSelect.push(node as SceneNode);
    });
    figma.currentPage.selection = nodesToSelect;
  }

  // 3. 텍스트 적용 (번역 또는 원본 복원)
  if (msg.type === 'apply-text') {
    const ids = msg.ids as string[];
    const text = msg.text as string;
    
    let appliedCount = 0;
    for (const id of ids) {
      const node = figma.getNodeById(id);
      if (node && node.type === 'TEXT') {
        const textNode = node as TextNode;
        
        // 폰트 로드 후 텍스트 변경
        (async () => {
          try {
            // 모든 폰트 로드
            await figma.loadFontAsync(textNode.fontName as FontName);
            textNode.characters = text;
            appliedCount++;
          } catch (e) {
            console.error('Failed to apply text to node', id, e);
            // Mixed fonts인 경우 각 문자의 폰트를 개별 로드 시도
            try {
              const len = textNode.characters.length;
              for (let i = 0; i < len; i++) {
                const font = textNode.getRangeFontName(i, i + 1);
                if (font !== figma.mixed) {
                  await figma.loadFontAsync(font as FontName);
                }
              }
              textNode.characters = text;
              appliedCount++;
            } catch (e2) {
              console.error('Failed to apply text even after loading all fonts', id, e2);
              figma.notify(`⚠️ 폰트 로드 실패: ${id}`, { error: true });
            }
          }
        })();
      }
    }
    
    if (appliedCount > 0 || ids.length === 1) {
      figma.notify(`✅ 텍스트가 적용되었습니다.`);
    }
  }

  // 4. 번역/리소스 확인
  if (msg.type === 'check-translation') {
    const text = msg.text;
    const matches = findMatches(text);
    // DEBUG: Log to console to verify resources access
    // console.log('Checking translation for:', text, 'Matches found:', matches.length);
    figma.ui.postMessage({ type: 'translation-check-result', data: matches, originalText: text });
  }

  // 4. Batch Translation/Resource Check
  if (msg.type === 'check-batch-translation') {
    const items = msg.items; // Array of { id, text, ... }
    const results = items.map((item: any) => {
      const matches = findMatches(item.text);
      return {
        ...item,
        matches: matches
      };
    });
    figma.ui.postMessage({ type: 'batch-translation-check-result', data: results });
  }

  // 5. 배치 번역 결과 저장 (Document Shared)
  if (msg.type === 'save-batch-results') {
    const strData = msg.data ? JSON.stringify(msg.data) : '';
    figma.root.setPluginData('pluginBatchResults', strData);
  }

  // 6. 배치 Context 저장 (Document Shared)
  if (msg.type === 'save-batch-context') {
    // figma.clientStorage.setAsync('pluginBatchContext', msg.data); -> Removed
    const strData = msg.data || '';
    figma.root.setPluginData('pluginBatchContext', strData);
  }

  // 7. 하이라이트 제거
  if (msg.type === 'clear-highlights') {
    clearHighlights(msg.ids);
    if (msg.ids && Array.isArray(msg.ids)) {
      msg.ids.forEach((id: string) => currentTextIds.delete(id));
    }
  }
};

// Selection Change Listener to sync with UI
figma.on('selectionchange', () => {
    const selection = figma.currentPage.selection;
    if (selection.length > 0) {
        // Send first selected ID to UI to auto-focus in list if present
        figma.ui.postMessage({ type: 'selection-changed', id: selection[0].id });
    }
});

// --- Highlight Helpers ---
function highlightNode(node: SceneNode) {
  // 이미 하이라이트가 있으면 건너뛰기
  if (highlightMap.has(node.id)) return;
  
  const bounds = node.absoluteBoundingBox;
  if (!bounds) return;

  try {
    const rect = figma.createRectangle();
    rect.name = "🔴 Extracted Highlight";
    // 약간의 여백
    rect.x = bounds.x - 4;
    rect.y = bounds.y - 4;
    rect.resize(bounds.width + 8, bounds.height + 8);
    
    // 스타일: 투명 배경, 빨간색 점선 테두리
    rect.fills = [];
    rect.strokes = [{ type: 'SOLID', color: { r: 1, g: 0.2, b: 0.2 } }]; // Red
    rect.strokeWeight = 4;
    try {
      (rect as any).strokeDashPattern = [4, 4]; // 점선 (일부 버전에서 지원 안될 수 있음)
    } catch (e) {}
    rect.cornerRadius = 4;
    
    // 잠금 및 선택 불가 (방해되지 않도록)
    rect.locked = true; 
    
    // 현재 페이지에 추가
    figma.currentPage.appendChild(rect);
    
    // 식별용 데이터 저장 (rect에는 저장 가능)
    try {
      rect.setPluginData('isHighlight', 'true');
      rect.setPluginData('targetId', node.id);
    } catch (e) {
      // setPluginData 실패해도 계속 진행
    }

    // 메모리 매핑에 저장
    highlightMap.set(node.id, rect.id);
  } catch (e) {
    // 인스턴스 내부 노드 등에서 실패할 수 있음 - 조용히 무시
  }
}

function clearHighlights(targetIds?: string[]) {
  // Case 1: 특정 텍스트 노드들에 대한 하이라이트만 삭제 (체크박스 해제)
  if (targetIds && targetIds.length > 0) {
    targetIds.forEach(textNodeId => {
      let removed = false;
      
      // 1. 메모리 매핑에서 찾기 (가장 빠름)
      const mappedHighlightId = highlightMap.get(textNodeId);
      if (mappedHighlightId) {
        const highlightRect = figma.getNodeById(mappedHighlightId);
        if (highlightRect) {
          try {
            highlightRect.remove();
            removed = true;
          } catch (e) {}
        }
        highlightMap.delete(textNodeId);
      }

      // 2. Fallback: rect의 targetId로 찾기
      if (!removed) {
        const highlights = figma.currentPage.findAll(n => n.name === "🔴 Extracted Highlight");
        highlights.forEach(h => {
          try {
            if (h.getPluginData('targetId') === textNodeId) {
              h.remove();
            }
          } catch (e) {}
        });
      }
    });
    return;
  }

  // Case 2: 전체 삭제 (초기화)
  const highlights = figma.currentPage.findAll(n => n.name === "🔴 Extracted Highlight");
  highlights.forEach(h => {
    try {
      h.remove();
    } catch(e) {}
  });
  
  // 매핑도 초기화
  highlightMap.clear();
}

// Helper to strip tags and variables from resource strings for comparison
// e.g. "Completed <u>{{daysProgress}}</u> days" -> "completed days"
// e.g. "Hello {{name}}" -> "hello "
function normalizeResourceString(str: string): string {
  // Remove HTML tags
  let normalized = str.replace(/<[^>]*>/g, '');
  // Remove {{...}} variables
  normalized = normalized.replace(/{{[^}]*}}/g, '');
  // Remove special chars AND numbers (chunking strategy)
  // Split into words and join to normalize spaces
  return normalized.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 1).join(' ').trim();
}

function normalizeQueryString(str: string): string {
    // Same normalization for query: remove numbers, special chars, keep only meaningful words > 1 char
    return str.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 1).join(' ').trim();
}

function findMatches(queryText: string) {
  const results: any[] = [];
  const resAny = resources as any;
  if (!resAny || !resAny['en']) return results;

  const enResources = resAny['en'];
  const deResources = resAny['de'] || {};
  const frResources = resAny['fr'] || {};
  
  const queryRaw = queryText.trim().toLowerCase();
  const queryNormalized = normalizeQueryString(queryText);
  
  // Ignore very short queries to avoid bad matches like "up" for "uploading"
  if (queryNormalized.length < 3) return [];

  // Iterate over all keys in en resources
  for (const groupKey in enResources) {
      const group = enResources[groupKey];
      for (const key in group) {
          const value = group[key];
          if (typeof value === 'string') {
              const valLower = value.toLowerCase();
              const valNormalized = normalizeResourceString(value);
              
              let matchType = null;
              let score = 0;

              // 1. Exact match (Raw)
              if (valLower === queryRaw) {
                  matchType = 'EXACT';
                  score = 100;
              }
              // 2. Normalized Match (Chunking / Semantic-ish)
              // Only match if significantly similar and length is sufficient
              else if (valNormalized === queryNormalized && queryNormalized.length > 0) {
                  matchType = 'PATTERN_MATCH';
                  score = 90;
              }
              // 3. Partial match (Strict containment)
              // Prevent "up" matching "uploading" by checking word boundaries or length ratio
              else if (queryRaw.length > 4 && valLower.includes(queryRaw)) {
                   // Ensure it's not just a tiny substring
                   matchType = 'PARTIAL';
                   score = 60;
              }
              else if (valLower.length > 4 && queryRaw.includes(valLower)) {
                   matchType = 'PARTIAL';
                   score = 50;
              }

              if (matchType) {
                  const deValue = deResources[groupKey]?.[key];
                  const frValue = frResources[groupKey]?.[key];
                  
                  results.push({ 
                      key: `${groupKey}.${key}`, 
                      value: value, 
                      deValue: deValue,
                      frValue: frValue,
                      type: matchType, 
                      score: score 
                  });
              }
          }
      }
  }

  // Sort by score
  return results.sort((a, b) => b.score - a.score).slice(0, 5); // Return top 5
}
