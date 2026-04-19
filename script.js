(function () {
  /*
   * Knots/edges/menus/packs live in one document; canvas shows the active menu slice.
   * ui.layout stores positions only — no semantic knot types in core paths.
   * Helpers use knot/menu names (setKnotLayout, getKnotIdsForMenu); legacy import keys may still say nodes/nodeIds.
   * files.menuText + files.structureText are regenerated from hierarchy + menus (single source).
   * Selection, drag, connect, hover are runtime-only and not exported.
   */
  const STORAGE_KEY = "ruvia.v2.state";
  const THEME_KEY = "ruvia.theme";
  const ZOOM_KEY = "ruvia.zoom";
  const GLOBAL_SCALE = 3;
  const SPEC = "ruvia-doc/0.1";

  const app = {
    state: loadState(),
    selectedKnotId: null,
    dragKnot: null,
    offsetX: 0,
    offsetY: 0,
    connectFrom: null,
    tempPoint: null,
    dragHint: null,
    hoverEdgeId: null,
    zoom: loadZoom(),
    resizeObserver: null,
    dom: {}
  };

  init();

  function init() {
    app.dom.workspace = document.getElementById("workspace");
    app.dom.canvasPane = document.querySelector(".canvas-pane");
    app.dom.knotLayer = document.getElementById("knotLayer");
    app.dom.edgeLayer = document.getElementById("edgeLayer");
    app.dom.edgeToolLayer = ensureEdgeToolLayer();
    app.dom.stash = document.getElementById("stash");
    app.dom.templateTray = document.getElementById("templateTray");
    app.dom.newKnotBtn = document.getElementById("newKnotBtn");
    app.dom.exportBtn = document.getElementById("exportBtn");
    app.dom.importBtn = document.getElementById("importBtn");
    app.dom.importInput = document.getElementById("importInput");
    app.dom.resetBtn = document.getElementById("resetBtn");
    app.dom.zoomOutBtn = document.getElementById("zoomOutBtn");
    app.dom.zoomInBtn = document.getElementById("zoomInBtn");

    applySavedTheme();
    bindThemeHotkeys();
    bindToolbar();
    bindZoomControls();
    bindKnotEvents();
    bindConnectEvents();
    bindEdgeEvents();
    renderTemplates();

    if (!app.state.knots.length) {
      createKnot({
        contentExpanded: true,
        layout: { x: 120, y: 80, zone: "canvas" }
      });
    }

    applyZoom();
    render();
  }

  function ensureEdgeToolLayer() {
    let layer = document.getElementById("edgeToolLayer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "edgeToolLayer";
      layer.className = "edge-tool-layer";
      app.dom.canvasPane.appendChild(layer);
    }
    return layer;
  }

  function applySavedTheme() {
    const mode = localStorage.getItem(THEME_KEY);
    if (mode === "white") {
      document.body.classList.add("white-mode");
    } else {
      document.body.classList.remove("white-mode");
    }
  }

  function bindThemeHotkeys() {
    window.addEventListener("keydown", (event) => {
      if (event.target && /input|textarea/i.test(event.target.tagName)) return;
      if (event.key.toLowerCase() !== "w") return;

      document.body.classList.toggle("white-mode");
      localStorage.setItem(
        THEME_KEY,
        document.body.classList.contains("white-mode") ? "white" : "dark"
      );
    });
  }

  function bindToolbar() {
    app.dom.newKnotBtn.addEventListener("click", () => {
      createKnot({ contentExpanded: true });
      touchDocumentUpdated();
      saveState();
      render();
    });

    app.dom.exportBtn.addEventListener("click", () => {
      const payload = exportDocument(app.state);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json"
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `ruvia-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    });

    app.dom.importBtn.addEventListener("click", () => {
      app.dom.importInput.value = "";
      app.dom.importInput.click();
    });

    app.dom.importInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const raw = JSON.parse(await file.text());
        app.state = loadFromImport(raw);
        app.selectedKnotId = null;
        saveState();
        render();
      } catch (_error) {
        alert("Import failed: invalid JSON");
      }
    });

    app.dom.resetBtn.addEventListener("click", () => {
      if (!confirm("Reset workspace?")) return;
      app.state = createDefaultState();
      app.selectedKnotId = null;
      saveState();
      render();
    });
  }

  function bindZoomControls() {
    if (app.dom.zoomOutBtn) {
      app.dom.zoomOutBtn.addEventListener("click", () => {
        setZoom(app.zoom - 0.1);
      });
    }

    if (app.dom.zoomInBtn) {
      app.dom.zoomInBtn.addEventListener("click", () => {
        setZoom(app.zoom + 0.1);
      });
    }

    window.addEventListener("keydown", (event) => {
      if (event.target && /input|textarea/i.test(event.target.tagName)) return;

      if (event.key === "[") {
        setZoom(app.zoom - 0.1);
      }

      if (event.key === "]") {
        setZoom(app.zoom + 0.1);
      }
    });
  }

  function setZoom(value) {
    app.zoom = clampZoom(value);
    saveZoom();
    applyZoom();
    renderEdges();
  }

  function applyZoom() {
    const z = getEffectiveZoom();
    app.dom.knotLayer.style.transformOrigin = "0 0";
    app.dom.edgeLayer.style.transformOrigin = "0 0";
    app.dom.edgeToolLayer.style.transformOrigin = "0 0";
    app.dom.knotLayer.style.transform = `scale(${z})`;
    app.dom.edgeLayer.style.transform = `scale(${z})`;
    app.dom.edgeToolLayer.style.transform = `scale(${z})`;
  }

  function saveZoom() {
    localStorage.setItem(ZOOM_KEY, String(app.zoom));
  }

  function loadZoom() {
    const raw = Number(localStorage.getItem(ZOOM_KEY));
    if (!Number.isFinite(raw)) return 1.35;
    return clampZoom(raw);
  }

  function getEffectiveZoom() {
    return app.zoom * GLOBAL_SCALE;
  }

  function clampZoom(value) {
    return Math.min(1.6, Math.max(0.5, Number(value.toFixed(2))));
  }

  function renderTemplates() {
    const labels = ["+"];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < labels.length; i++) {
      const btn = document.createElement("button");
      btn.className = "template-btn";
      btn.type = "button";
      btn.textContent = labels[i];
      btn.title = "New knot in stash";
      btn.addEventListener("click", () => {
        createKnot({
          contentExpanded: true,
          x: app.dom.canvasPane.clientWidth / getEffectiveZoom() - 210,
          y: 48,
          zone: "stash"
        });
        touchDocumentUpdated();
        saveState();
        render();
      });
      frag.append(btn);
    }
    app.dom.templateTray.replaceChildren(frag);
  }

  function bindKnotEvents() {
    app.dom.knotLayer.addEventListener("mousedown", (event) => {
      if (event.button !== 0 || app.connectFrom) return;

      const header = event.target.closest(".knot-header");
      if (!header) return;

      const knotEl = header.closest(".knot");
      if (!knotEl) return;

      if (event.target.closest(".delete-btn")) return;

      const knot = findKnot(knotEl.dataset.knotId);
      if (!knot) return;

      app.selectedKnotId = knot.id;
      app.dragKnot = knot;
      bringKnotToFront(knot.id);

      const wr = app.dom.canvasPane.getBoundingClientRect();
      const kr = knotEl.getBoundingClientRect();

      app.offsetX = (event.clientX - kr.left) / getEffectiveZoom();
      app.offsetY = (event.clientY - kr.top) / getEffectiveZoom();

      const onMove = (moveEvent) => {
        const layout = getKnotLayout(app.state, knot.id);
        layout.x = clamp(
          (moveEvent.clientX - wr.left) / getEffectiveZoom() - app.offsetX,
          0,
          wr.width / getEffectiveZoom() - 40
        );
        layout.y = clamp(
          (moveEvent.clientY - wr.top) / getEffectiveZoom() - app.offsetY,
          0,
          wr.height / getEffectiveZoom() - 20
        );
        layout.zone = isPointerInStash(moveEvent.clientX, moveEvent.clientY) ? "stash" : "canvas";
        setKnotLayout(app.state, knot.id, layout);
        app.dragHint = computeDragHint(knot);
        render();
        app.dom.stash.classList.toggle("is-active", layout.zone === "stash");
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);

        if (app.dragHint) applyDragHint(knot, app.dragHint);

        app.dragKnot = null;
        app.dragHint = null;
        app.dom.stash.classList.remove("is-active");

        touchDocumentUpdated();
        saveState();
        render();
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });

    app.dom.knotLayer.addEventListener("click", (event) => {
      const knotEl = event.target.closest(".knot");

      if (!knotEl) {
        app.selectedKnotId = null;
        render();
        return;
      }

      const knot = findKnot(knotEl.dataset.knotId);
      if (!knot) return;

      app.selectedKnotId = knot.id;

      if (event.target.classList.contains("delete-btn")) {
        deleteKnot(knot.id);
        touchDocumentUpdated();
        saveState();
        render();
        return;
      }

      if (event.target.classList.contains("side-add")) {
        const side = event.target.dataset.side;
        createExtendedKnot(knot, side);
        touchDocumentUpdated();
        saveState();
        render();
        return;
      }

      if (
        event.target.classList.contains("knot-title") ||
        event.target.classList.contains("knot-content-input")
      ) {
        return;
      }

      render();
    });

    app.dom.knotLayer.addEventListener("input", (event) => {
      const knotEl = event.target.closest(".knot");
      if (!knotEl) return;

      const knot = findKnot(knotEl.dataset.knotId);
      if (!knot) return;

      if (event.target.classList.contains("knot-content-input")) {
        ensureKnotContent(knot).text = event.target.value;
        touchDocumentUpdated();
        saveState();
      }
    });

    app.dom.knotLayer.addEventListener(
      "focusin",
      (event) => {
        if (!event.target.classList.contains("knot-title")) return;
        const knotEl = event.target.closest(".knot");
        if (!knotEl) return;
        const knot = findKnot(knotEl.dataset.knotId);
        if (!knot) return;

        event.target.textContent = getKnotEditingTitle(knot);
      },
      true
    );

    app.dom.knotLayer.addEventListener(
      "focusout",
      (event) => {
        if (!event.target.classList.contains("knot-title")) return;
        const knotEl = event.target.closest(".knot");
        if (!knotEl) return;
        const knot = findKnot(knotEl.dataset.knotId);
        if (!knot) return;

        knot.title = (event.target.textContent || "").trim();
        touchDocumentUpdated();
        saveState();
        render();
      },
      true
    );

    app.dom.knotLayer.addEventListener("dblclick", (event) => {
      const knotEl = event.target.closest(".knot");
      if (!knotEl) return;

      const knot = findKnot(knotEl.dataset.knotId);
      if (!knot) return;

      if (event.target.classList.contains("knot-header") || event.target.classList.contains("knot-title")) {
        const meta = ensureKnotUiMeta(knot);
        meta.contentExpanded = !meta.contentExpanded;
        touchDocumentUpdated();
        saveState();
        render();
      }
    });
  }

  function bindConnectEvents() {
    app.dom.knotLayer.addEventListener("mousedown", (event) => {
      const port = event.target.closest(".port");
      if (!port || event.button !== 0) return;

      event.stopPropagation();
      event.preventDefault();

      const knotEl = port.closest(".knot");
      if (!knotEl) return;

      const knotId = knotEl.dataset.knotId;
      const side = port.dataset.side;
      const point = getPortCenter(knotId, side);
      if (!point) return;

      app.connectFrom = { knotId, side };
      app.tempPoint = { x: point.x, y: point.y };
      renderEdges();

      const onMove = (moveEvent) => {
        const rect = app.dom.canvasPane.getBoundingClientRect();
        app.tempPoint = {
          x: (moveEvent.clientX - rect.left) / getEffectiveZoom(),
          y: (moveEvent.clientY - rect.top) / getEffectiveZoom()
        };
        renderEdges();
      };

      const onUp = (upEvent) => {
        const targetPort = upEvent.target.closest(".port");

        if (targetPort) {
          const toEl = targetPort.closest(".knot");
          tryCreateEdge({
            fromKnotId: app.connectFrom.knotId,
            fromSide: app.connectFrom.side,
            toKnotId: toEl?.dataset.knotId,
            toSide: targetPort.dataset.side
          });
        }

        app.connectFrom = null;
        app.tempPoint = null;

        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);

        touchDocumentUpdated();
        saveState();
        render();
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  }

  function bindEdgeEvents() {
    app.dom.edgeLayer.addEventListener("mouseover", (event) => {
      const path = event.target.closest(".edge");
      if (!path || !path.dataset.edgeId || path.classList.contains("temp")) return;
      app.hoverEdgeId = path.dataset.edgeId;
      renderEdgeTools();
    });

    app.dom.edgeLayer.addEventListener("mouseout", (event) => {
      const path = event.target.closest(".edge");
      if (!path || !path.dataset.edgeId || path.classList.contains("temp")) return;

      const related = event.relatedTarget;
      if (
        related &&
        related.closest &&
        related.closest(".edge-cut") &&
        related.closest(".edge-cut").dataset.edgeId === path.dataset.edgeId
      ) {
        return;
      }

      app.hoverEdgeId = null;
      renderEdgeTools();
    });

    app.dom.edgeToolLayer.addEventListener("mouseover", (event) => {
      const btn = event.target.closest(".edge-cut");
      if (!btn || !btn.dataset.edgeId) return;
      app.hoverEdgeId = btn.dataset.edgeId;
      renderEdgeTools();
    });

    app.dom.edgeToolLayer.addEventListener("mouseout", (event) => {
      const btn = event.target.closest(".edge-cut");
      if (!btn || !btn.dataset.edgeId) return;
      app.hoverEdgeId = null;
      renderEdgeTools();
    });

    app.dom.edgeToolLayer.addEventListener("click", (event) => {
      const btn = event.target.closest(".edge-cut");
      if (!btn || !btn.dataset.edgeId) return;
      const edgeId = btn.dataset.edgeId;
      app.state.edges = app.state.edges.filter((edge) => edge.id !== edgeId);
      for (const menu of app.state.menus) {
        menu.edgeIds = menu.edgeIds.filter((id) => id !== edgeId);
      }
      app.hoverEdgeId = null;
      touchDocumentUpdated();
      saveState();
      render();
    });
  }

  function createKnot(options = {}) {
    const id = `k${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const knot = {
      id,
      title: resolveNewKnotTitle(app.state, options),
      content: { text: options.text ?? "" },
      meta: options.meta && typeof options.meta === "object" ? structuredClone(options.meta) : {}
    };

    const layout = {
      x: options.x ?? 140 + app.state.knots.length * 12,
      y: options.y ?? 90 + app.state.knots.length * 10,
      width: Number.isFinite(options.width) ? options.width : 132,
      height: Number.isFinite(options.height) ? options.height : 42,
      zone: options.zone ?? "canvas",
      zIndex: nextZIndex()
    };

    if (options.parentId != null) {
      knot.meta.parentId = String(options.parentId);
    }
    const uiMeta = ensureKnotUiMeta(knot);
    if (options.contentExpanded !== undefined) {
      uiMeta.contentExpanded = Boolean(options.contentExpanded);
    }
    if (options.childrenCollapsed !== undefined) {
      uiMeta.childrenCollapsed = Boolean(options.childrenCollapsed);
    }

    app.state.knots.push(knot);
    setKnotLayout(app.state, id, layout);

    const menu = getActiveMenu(app.state);
    if (menu) attachKnotToMenu(app.state, menu.id, id);

    syncHierarchyFiles(app.state);
    return knot;
  }

  function createExtendedKnot(sourceKnot, side) {
    const gapX = 92;
    const gapY = 0;
    const srcLayout = getKnotLayout(app.state, sourceKnot.id);

    const newKnot = createKnot({
      parentKnot: sourceKnot,
      parentId: sourceKnot.id,
      contentExpanded: true,
      x: side === "right" ? srcLayout.x + gapX : Math.max(0, srcLayout.x - gapX),
      y: srcLayout.y + gapY,
      zone: srcLayout.zone
    });

    if (side === "right") {
      ensureEdge(app.state, sourceKnot.id, newKnot.id, "link");
    } else {
      ensureEdge(app.state, newKnot.id, sourceKnot.id, "link");
    }

    bringKnotToFront(newKnot.id);
    app.selectedKnotId = newKnot.id;
    return newKnot;
  }

  function deleteKnot(knotId) {
    app.state.knots = app.state.knots.filter((k) => k.id !== knotId);
    delete app.state.ui.layout.knots[knotId];

    for (const knot of app.state.knots) {
      const pid = knot.meta && knot.meta.parentId;
      if (pid === knotId) delete knot.meta.parentId;
    }

    for (const menu of app.state.menus) {
      menu.knotIds = menu.knotIds.filter((id) => id !== knotId);
      menu.edgeIds = menu.edgeIds.filter((id) => {
        const e = getEdgeById(app.state, id);
        return e && e.from !== knotId && e.to !== knotId;
      });
    }

    app.state.edges = app.state.edges.filter((e) => e.from !== knotId && e.to !== knotId);

    if (app.selectedKnotId === knotId) {
      app.selectedKnotId = null;
    }

    syncHierarchyFromMenus(app.state);
    syncHierarchyFiles(app.state);
  }

  function tryCreateEdge({ fromKnotId, fromSide, toKnotId, toSide }) {
    if (!toKnotId || fromKnotId === toKnotId) return;
    if (fromSide !== "right" || toSide !== "left") return;

    if (app.state.edges.some((e) => e.from === fromKnotId && e.to === toKnotId)) {
      return;
    }

    const from = findKnot(fromKnotId);
    const to = findKnot(toKnotId);
    if (!from || !to) return;

    ensureEdge(app.state, fromKnotId, toKnotId, "link");
  }

  function render() {
    renderKnots();
    renderEdges();
  }

  function renderKnots() {
    const visibleIds = new Set(getVisibleKnotIds());
    const frag = document.createDocumentFragment();

    for (const knot of app.state.knots) {
      if (!visibleIds.has(knot.id)) continue;

      const layout = getKnotLayout(app.state, knot.id);
      const uiMeta = knot.meta && knot.meta.ui ? knot.meta.ui : {};
      const contentExpanded = uiMeta.contentExpanded !== false;

      const knotEl = document.createElement("article");
      knotEl.className = "knot";
      knotEl.dataset.knotId = knot.id;
      knotEl.style.left = `${layout.x}px`;
      knotEl.style.top = `${layout.y}px`;
      knotEl.style.width = `${layout.width || 132}px`;
      knotEl.style.zIndex = String(layout.zIndex || 1);

      if (contentExpanded) knotEl.classList.add("content-expanded");
      if (uiMeta.childrenCollapsed) knotEl.classList.add("is-child-collapsed");
      if (knot.id === app.selectedKnotId) knotEl.classList.add("is-selected");

      const header = document.createElement("div");
      header.className = "knot-header";

      const title = document.createElement("div");
      title.className = "knot-title";
      title.contentEditable = "true";
      title.spellcheck = false;
      title.textContent = getKnotDisplayTitle(knot);
      title.dataset.rawTitle = getKnotEditingTitle(knot);

      const actions = document.createElement("div");
      actions.className = "knot-actions";

      const deleteBtn = makeBtn("delete-btn", "x", "Delete knot");
      actions.append(deleteBtn);

      header.append(title, actions);

      const contentWrap = document.createElement("div");
      contentWrap.className = "knot-content";

      const textInput = document.createElement("textarea");
      textInput.className = "knot-content-input";
      textInput.value = ensureKnotContent(knot).text;
      textInput.placeholder = "content";
      textInput.style.height = `${layout.height || 42}px`;
      contentWrap.append(textInput);

      const leftPort = document.createElement("div");
      leftPort.className = "port left";
      leftPort.dataset.side = "left";

      const rightPort = document.createElement("div");
      rightPort.className = "port right";
      rightPort.dataset.side = "right";

      const addLeft = document.createElement("button");
      addLeft.type = "button";
      addLeft.className = "side-add left";
      addLeft.dataset.side = "left";
      addLeft.title = "extend left";
      addLeft.textContent = "+";

      const addRight = document.createElement("button");
      addRight.type = "button";
      addRight.className = "side-add right";
      addRight.dataset.side = "right";
      addRight.title = "extend right";
      addRight.textContent = "+";

      knotEl.append(header, contentWrap, leftPort, rightPort, addLeft, addRight);
      frag.append(knotEl);
    }

    if (app.dragHint) {
      const hint = document.createElement("div");
      hint.className = "drag-hint";
      hint.style.left = `${app.dragHint.x}px`;
      hint.style.top = `${app.dragHint.y}px`;
      hint.style.width = `${app.dragHint.w}px`;
      hint.style.height = `${app.dragHint.h}px`;
      frag.append(hint);
    }

    app.dom.knotLayer.replaceChildren(frag);
    bindKnotResizeObservers();
  }

  function bindKnotResizeObservers() {
    if (typeof ResizeObserver === "undefined") return;

    if (!app.resizeObserver) {
      app.resizeObserver = new ResizeObserver((entries) => {
        let changed = false;
        for (const entry of entries) {
          const textarea = entry.target;
          const knotEl = textarea.closest(".knot");
          if (!knotEl) continue;

          const knot = findKnot(knotEl.dataset.knotId);
          if (!knot) continue;

          const nextWidth = Math.round(entry.contentRect.width);
          const nextHeight = Math.round(entry.contentRect.height);

          if (
            !Number.isFinite(nextWidth) ||
            !Number.isFinite(nextHeight) ||
            nextWidth <= 0 ||
            nextHeight <= 0
          ) {
            continue;
          }

          const clampedWidth = Math.max(96, nextWidth);
          const clampedHeight = Math.max(10, nextHeight);

          const layout = getKnotLayout(app.state, knot.id);
          if (layout.width === clampedWidth && layout.height === clampedHeight) {
            continue;
          }

          layout.width = clampedWidth;
          layout.height = clampedHeight;
          knotEl.style.width = `${layout.width}px`;
          textarea.style.height = `${layout.height}px`;
          changed = true;
        }

        if (changed) {
          touchDocumentUpdated();
          saveState();
          renderEdges();
        }
      });
    }

    app.resizeObserver.disconnect();
    const textareas = app.dom.knotLayer.querySelectorAll(".knot-content-input");
    for (const textarea of textareas) {
      app.resizeObserver.observe(textarea);
    }
  }

  function renderEdges() {
    const svg = app.dom.edgeLayer;
    const wr = app.dom.canvasPane.getBoundingClientRect();

    svg.setAttribute("width", String(wr.width / getEffectiveZoom()));
    svg.setAttribute("height", String(wr.height / getEffectiveZoom()));
    svg.setAttribute("viewBox", `0 0 ${wr.width / getEffectiveZoom()} ${wr.height / getEffectiveZoom()}`);

    const visibleIds = new Set(getVisibleKnotIds());
    const paths = [];

    const activeEdgeIds = new Set(getEdgesForActiveMenu(app.state).map((e) => e.id));

    for (const edge of app.state.edges) {
      if (!activeEdgeIds.has(edge.id)) continue;
      if (!visibleIds.has(edge.from) || !visibleIds.has(edge.to)) continue;

      const from = getPortCenter(edge.from, "right");
      const to = getPortCenter(edge.to, "left");
      if (!from || !to) continue;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.classList.add("edge");
      path.dataset.edgeId = edge.id;
      path.setAttribute("d", edgePath(from, to));
      path.setAttribute("stroke", edgeStroke(edge.relation));
      path.setAttribute("title", edge.relation || "link");
      paths.push(path);
    }

    if (app.connectFrom && app.tempPoint) {
      const origin = getPortCenter(app.connectFrom.knotId, app.connectFrom.side);
      if (origin) {
        const temp = document.createElementNS("http://www.w3.org/2000/svg", "path");
        temp.classList.add("edge", "temp");
        temp.setAttribute("d", edgePath(origin, app.tempPoint));
        paths.push(temp);
      }
    }

    svg.replaceChildren(...paths);
    renderEdgeTools();
  }

  function renderEdgeTools() {
    const layer = app.dom.edgeToolLayer;
    if (!layer) return;

    if (!app.hoverEdgeId) {
      layer.replaceChildren();
      return;
    }

    const edge = app.state.edges.find((item) => item.id === app.hoverEdgeId);
    if (!edge) {
      layer.replaceChildren();
      return;
    }

    const from = getPortCenter(edge.from, "right");
    const to = getPortCenter(edge.to, "left");
    if (!from || !to) {
      layer.replaceChildren();
      return;
    }

    const mid = edgeMidpoint(from, to);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "edge-cut is-visible";
    btn.dataset.edgeId = edge.id;
    btn.textContent = "✂";
    btn.title = "cut edge";
    btn.style.left = `${mid.x}px`;
    btn.style.top = `${mid.y}px`;
    layer.replaceChildren(btn);
  }

  function getPortCenter(knotId, side) {
    const knotEl = app.dom.knotLayer.querySelector(`.knot[data-knot-id="${knotId}"]`);
    if (!knotEl) return null;

    const port = knotEl.querySelector(`.port.${side}`);
    if (!port) return null;

    const wr = app.dom.canvasPane.getBoundingClientRect();
    const rect = port.getBoundingClientRect();

    return {
      x: (rect.left - wr.left + rect.width / 2) / getEffectiveZoom(),
      y: (rect.top - wr.top + rect.height / 2) / getEffectiveZoom()
    };
  }

  function edgePath(from, to) {
    const dx = Math.abs(to.x - from.x);
    const c = Math.max(16, dx * 0.35);
    return `M ${from.x} ${from.y} C ${from.x + c} ${from.y}, ${to.x - c} ${to.y}, ${to.x} ${to.y}`;
  }

  function edgeMidpoint(from, to) {
    const dx = Math.abs(to.x - from.x);
    const c = Math.max(16, dx * 0.35);
    const p0 = from;
    const p1 = { x: from.x + c, y: from.y };
    const p2 = { x: to.x - c, y: to.y };
    const p3 = to;
    const t = 0.5;
    const mt = 1 - t;
    const x =
      mt * mt * mt * p0.x +
      3 * mt * mt * t * p1.x +
      3 * mt * t * t * p2.x +
      t * t * t * p3.x;
    const y =
      mt * mt * mt * p0.y +
      3 * mt * mt * t * p1.y +
      3 * mt * t * t * p2.y +
      t * t * t * p3.y;
    return { x, y };
  }

  function findKnot(knotId) {
    return app.state.knots.find((k) => k.id === knotId) || null;
  }

  function getVisibleKnotIds() {
    const memberIds = new Set(getKnotIdsForMenu(app.state, app.state.ui.activeMenuId));
    const hidden = new Set();
    const childrenMap = new Map();

    for (const knot of app.state.knots) {
      if (!memberIds.has(knot.id)) continue;
      const pid = knot.meta && knot.meta.parentId != null ? knot.meta.parentId : null;
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid).push(knot.id);
    }

    for (const knot of app.state.knots) {
      if (!memberIds.has(knot.id)) continue;
      const ui = knot.meta && knot.meta.ui;
      if (!ui || !ui.childrenCollapsed) continue;
      markDescendantsHidden(knot.id, childrenMap, hidden);
    }

    return app.state.knots
      .filter((k) => memberIds.has(k.id) && !hidden.has(k.id))
      .map((k) => k.id);
  }

  function markDescendantsHidden(rootId, childrenMap, hidden) {
    const stack = [...(childrenMap.get(rootId) || [])];

    while (stack.length) {
      const id = stack.pop();
      hidden.add(id);
      stack.push(...(childrenMap.get(id) || []));
    }
  }

  function computeDragHint(knot) {
    const layout = getKnotLayout(app.state, knot.id);
    let nearest = null;
    const snap = 30;

    for (const target of app.state.knots) {
      if (target.id === knot.id) continue;
      if (!getKnotIdsForMenu(app.state, app.state.ui.activeMenuId).includes(target.id)) continue;

      const tl = getKnotLayout(app.state, target.id);
      const belowDx = Math.abs(layout.x - tl.x);
      const belowDy = Math.abs(layout.y - (tl.y + 46));
      const rightDx = Math.abs(layout.x - (tl.x + 128));
      const rightDy = Math.abs(layout.y - tl.y);

      if (belowDx < snap && belowDy < snap) {
        nearest = {
          mode: "child",
          targetId: target.id,
          x: tl.x,
          y: tl.y + 42,
          w: 112,
          h: 16
        };
      } else if (!nearest && rightDx < snap && rightDy < snap) {
        nearest = {
          mode: "link",
          targetId: target.id,
          x: tl.x + 124,
          y: tl.y,
          w: 56,
          h: 14
        };
      }
    }

    return nearest;
  }

  function applyDragHint(knot, hint) {
    const target = findKnot(hint.targetId);
    if (!target) return;
    const layout = getKnotLayout(app.state, knot.id);

    if (hint.mode === "child") {
      knot.meta = knot.meta || {};
      knot.meta.parentId = target.id;
      layout.x = getKnotLayout(app.state, target.id).x;
      layout.y = getKnotLayout(app.state, target.id).y + 46;
      ensureEdge(app.state, target.id, knot.id, "link");
    } else if (hint.mode === "link") {
      if (knot.meta && knot.meta.parentId === target.id) {
        delete knot.meta.parentId;
      }
      layout.x = getKnotLayout(app.state, target.id).x + 128;
      layout.y = getKnotLayout(app.state, target.id).y;
      ensureEdge(app.state, target.id, knot.id, "link");
    }
    setKnotLayout(app.state, knot.id, layout);
  }

  function saveState() {
    syncHierarchyFiles(app.state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(app.state));
  }

  function loadState() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) raw = localStorage.getItem("ruvia.v1.state");
      if (!raw) return createDefaultState();
      return loadFromImport(JSON.parse(raw));
    } catch (_error) {
      return createDefaultState();
    }
  }

  function loadFromImport(raw) {
    if (!raw || typeof raw !== "object") return migrateLegacyState(raw);
    const looksNew =
      raw.spec === SPEC ||
      (Array.isArray(raw.menus) && Array.isArray(raw.knots));
    if (looksNew) {
      const doc = normalizeDocument(raw.spec === SPEC ? raw : { ...raw, spec: SPEC });
      applyImportedFiles(doc);
      syncHierarchyFiles(doc);
      const err = validateDocument(doc);
      if (err) console.warn("validateDocument:", err);
      return doc;
    }
    return migrateLegacyState(raw);
  }

  function exportDocument(state) {
    const out = structuredClone(state);
    syncHierarchyFiles(out);
    touchDocumentUpdated(out);
    return out;
  }

  function makeBtn(className, text, title) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.textContent = text;
    btn.title = title;
    return btn;
  }

  function edgeStroke() {
    if (document.body.classList.contains("white-mode")) {
      return "rgba(150,150,150,0.22)";
    }
    return "rgba(255, 0, 0, 0.28)";
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function nextZIndex() {
    const layouts = app.state.ui.layout.knots;
    let max = 0;
    for (const id of Object.keys(layouts)) {
      const z = layouts[id].zIndex || 0;
      if (z > max) max = z;
    }
    return max + 1;
  }

  function bringKnotToFront(knotId) {
    const layout = getKnotLayout(app.state, knotId);
    layout.zIndex = nextZIndex();
    setKnotLayout(app.state, knotId, layout);
  }

  function isPointerInStash(clientX, clientY) {
    const stashRect = app.dom.stash.getBoundingClientRect();

    return (
      clientX >= stashRect.left &&
      clientX <= stashRect.right &&
      clientY >= stashRect.top &&
      clientY <= stashRect.bottom
    );
  }

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  }

  function escapeRegExp(str) {
    return String(str).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }

  /** 顯示名：根層 knot-a … knot-z，用盡後 knot-aa …（內部 id 仍為不透明字串，見 docs/knot-title-vs-id.md） */
  function nextRootKnotLabel(state) {
    const titles = new Set(state.knots.map((k) => String(k.title || "").trim()));
    for (let i = 0; i < 26; i++) {
      const lab = `knot-${String.fromCharCode(97 + i)}`;
      if (!titles.has(lab)) return lab;
    }
    for (let a = 0; a < 26; a++) {
      for (let b = 0; b < 26; b++) {
        const lab = `knot-${String.fromCharCode(97 + a)}${String.fromCharCode(97 + b)}`;
        if (!titles.has(lab)) return lab;
      }
    }
    return `knot-x${Date.now().toString(36)}`;
  }

  /** 顯示名：在父標題後加 `--a`、`--b`…（父為 knot-a 則子為 knot-a--b） */
  function nextChildKnotLabel(state, parentTitle) {
    const base = String(parentTitle || "").trim();
    if (!base) return nextRootKnotLabel(state);
    const prefix = `${base}--`;
    const re = new RegExp(`^${escapeRegExp(prefix)}([a-z])$`);
    const used = new Set();
    for (const k of state.knots) {
      const m = re.exec(String(k.title || "").trim());
      if (m) used.add(m[1]);
    }
    for (let i = 0; i < 26; i++) {
      const ch = String.fromCharCode(97 + i);
      if (!used.has(ch)) return prefix + ch;
    }
    return prefix + "z" + Math.floor(Math.random() * 9);
  }

  /** 匯入時依序給 knot-a, knot-b, … */
  function knotLabelForImportIndex(index) {
    const i = Number(index) || 0;
    if (i < 26) return `knot-${String.fromCharCode(97 + i)}`;
    const j = i - 26;
    const hi = Math.floor(j / 26) % 26;
    const lo = j % 26;
    return `knot-${String.fromCharCode(97 + hi)}${String.fromCharCode(97 + lo)}`;
  }

  function resolveNewKnotTitle(state, options) {
    if (options.title != null && options.title !== "") return options.title;
    if (options.parentKnot && String(options.parentKnot.title || "").trim()) {
      return nextChildKnotLabel(state, options.parentKnot.title);
    }
    return nextRootKnotLabel(state);
  }

  function formatKnotTitle(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";

    if (value.includes("--")) {
      const parts = value.split("--").filter(Boolean);
      if (parts.length <= 3) return value;
      return `${parts[0]}--...--${parts[parts.length - 1]}`;
    }

    if (value.length <= 12) return value;
    return `${value.slice(0, 3)}...${value.slice(-3)}`;
  }

  function getKnotDisplayTitle(knot) {
    return formatKnotTitle(knot.title);
  }

  function getKnotEditingTitle(knot) {
    return String(knot.title || "");
  }

  function normalizeLegacyNodeTitle(title, fallbackIndex = 0) {
    const raw = String(title || "").trim();
    if (!raw) return knotLabelForImportIndex(fallbackIndex);
    if (/^node\s+\d+$/i.test(raw)) return knotLabelForImportIndex(fallbackIndex);
    if (/^knot\s+\d+$/i.test(raw)) return knotLabelForImportIndex(fallbackIndex);
    return raw;
  }

  function isoNow() {
    return new Date().toISOString();
  }

  function createEmptyDocument() {
    return {
      id: uid("doc"),
      title: "Untitled",
      createdAt: isoNow(),
      updatedAt: isoNow(),
      meta: {}
    };
  }

  function createDefaultMenu() {
    return {
      id: uid("m"),
      name: "Main",
      knotIds: [],
      edgeIds: [],
      meta: {}
    };
  }

  function createDefaultState() {
    const menu = createDefaultMenu();
    const folderId = uid("f");
    return {
      spec: SPEC,
      document: createEmptyDocument(),
      hierarchy: {
        folders: [{ id: folderId, name: "root", menuIds: [menu.id] }]
      },
      menus: [menu],
      packs: [],
      knots: [],
      edges: [],
      ui: {
        activeMenuId: menu.id,
        layout: { knots: {} }
      },
      files: {
        menuText: "",
        structureText: ""
      }
    };
  }

  function createKnotModel(partial = {}) {
    return {
      id: partial.id ?? uid("k"),
      title: partial.title ?? "Untitled",
      content: { text: ensureKnotContent(partial).text },
      meta: partial.meta && typeof partial.meta === "object" ? structuredClone(partial.meta) : {}
    };
  }

  function createEdgeModel(from, to, relation) {
    return {
      id: uid("e"),
      from,
      to,
      relation: relation || "link",
      meta: {}
    };
  }

  function createPack(partial = {}) {
    return {
      id: partial.id ?? uid("p"),
      name: partial.name ?? "Pack",
      menuIds: Array.isArray(partial.menuIds) ? partial.menuIds.slice() : [],
      meta: partial.meta && typeof partial.meta === "object" ? structuredClone(partial.meta) : {}
    };
  }

  function ensureKnotContent(knot) {
    if (!knot.content || typeof knot.content !== "object") {
      knot.content = { text: "" };
    }
    if (typeof knot.content.text !== "string") knot.content.text = "";
    return knot.content;
  }

  function ensureKnotUiMeta(knot) {
    knot.meta = knot.meta || {};
    knot.meta.ui = knot.meta.ui || {};
    return knot.meta.ui;
  }

  function normalizeDocument(input) {
    if (!input || typeof input !== "object") return createDefaultState();

    const out = {
      spec: input.spec === SPEC ? SPEC : SPEC,
      document: { ...createEmptyDocument(), ...(input.document || {}) },
      hierarchy: input.hierarchy && input.hierarchy.folders
        ? {
            folders: (input.hierarchy.folders || []).map((f) => ({
              id: String(f.id || uid("f")),
              name: String(f.name || "folder"),
              menuIds: Array.isArray(f.menuIds) ? f.menuIds.map(String) : []
            }))
          }
        : { folders: [] },
      menus: Array.isArray(input.menus)
        ? input.menus.map((m) => ({
            id: String(m.id || uid("m")),
            name: String(m.name || "Menu"),
            knotIds: Array.isArray(m.knotIds) ? m.knotIds.map(String) : [],
            edgeIds: Array.isArray(m.edgeIds) ? m.edgeIds.map(String) : [],
            entryKnotId: m.entryKnotId != null ? String(m.entryKnotId) : null,
            meta: m.meta && typeof m.meta === "object" ? structuredClone(m.meta) : {}
          }))
        : [],
      packs: Array.isArray(input.packs)
        ? input.packs.map((p) => ({
            id: String(p.id || uid("p")),
            name: String(p.name || "Pack"),
            menuIds: Array.isArray(p.menuIds)
              ? p.menuIds.map(String)
              : Array.isArray(p.listIds)
                ? p.listIds.map(String)
                : [],
            meta: p.meta && typeof p.meta === "object" ? structuredClone(p.meta) : {}
          }))
        : [],
      knots: Array.isArray(input.knots)
        ? input.knots.map((k) => normalizeKnotIn(k))
        : [],
      edges: Array.isArray(input.edges)
        ? input.edges.map((e) => ({
            id: String(e.id || uid("e")),
            from: String(e.from || ""),
            to: String(e.to || ""),
            relation: e.relation != null ? String(e.relation) : undefined,
            meta: e.meta && typeof e.meta === "object" ? structuredClone(e.meta) : {}
          }))
        : [],
      ui: {
        activeMenuId: input.ui && input.ui.activeMenuId != null ? input.ui.activeMenuId : null,
        activeListId:
          input.ui && input.ui.activeListId != null ? input.ui.activeListId : null,
        layout: {
          knots:
            input.ui &&
            input.ui.layout &&
            input.ui.layout.knots &&
            typeof input.ui.layout.knots === "object"
              ? structuredClone(input.ui.layout.knots)
              : input.ui &&
                  input.ui.layout &&
                  input.ui.layout.nodes &&
                  typeof input.ui.layout.nodes === "object"
                ? structuredClone(input.ui.layout.nodes)
                : {}
        }
      },
      files: {
        menuText: typeof input.files?.menuText === "string" ? input.files.menuText : "",
        structureText: typeof input.files?.structureText === "string" ? input.files.structureText : ""
      }
    };

    if (!out.menus.length && Array.isArray(input.lists)) {
      out.menus = input.lists.map((m) => ({
        id: String(m.id || uid("m")),
        name: String(m.name || "Menu"),
        knotIds: Array.isArray(m.nodeIds)
          ? m.nodeIds.map(String)
          : Array.isArray(m.knotIds)
            ? m.knotIds.map(String)
            : [],
        edgeIds: Array.isArray(m.edgeIds) ? m.edgeIds.map(String) : [],
        entryKnotId:
          m.entryNodeId != null
            ? String(m.entryNodeId)
            : m.entryKnotId != null
              ? String(m.entryKnotId)
              : null,
        meta: m.meta && typeof m.meta === "object" ? structuredClone(m.meta) : {}
      }));
    }

    if (!out.knots.length && Array.isArray(input.nodes)) {
      out.knots = input.nodes.map((n, i) => {
        const meta =
          n.meta && typeof n.meta === "object" ? structuredClone(n.meta) : {};
        if (n.type != null || n.parentId != null) {
          meta.legacy = { ...(meta.legacy || {}), type: n.type, parentId: n.parentId };
        }
        if (n.parentId) meta.parentId = String(n.parentId);
        meta.ui = {
          ...(meta.ui || {}),
          contentExpanded: n.notesExpanded !== false,
          childrenCollapsed: Boolean(n.childrenCollapsed)
        };
        return normalizeKnotIn({
          id: n.id,
          title: normalizeLegacyNodeTitle(n.title, i),
          meta,
          content: { text: String(n.notes ?? n.text ?? "") }
        });
      });
      input.nodes.forEach((n, i) => {
        const id = String(n.id ?? `k${i}`);
        out.ui.layout.knots[id] = {
          x: Number.isFinite(n.x) ? n.x : 120,
          y: Number.isFinite(n.y) ? n.y : 80,
          width: Number.isFinite(n.noteWidth) ? n.noteWidth : 132,
          height: Number.isFinite(n.noteHeight) ? n.noteHeight : 42,
          zone: n.zone === "stash" ? "stash" : "canvas",
          zIndex: Number.isFinite(n.zIndex) ? n.zIndex : i + 1
        };
      });
    }

    if (input.ui && input.ui.activeListId != null && out.ui.activeMenuId == null) {
      out.ui.activeMenuId = input.ui.activeListId;
    }

    if (!out.menus.length) {
      const m = createDefaultMenu();
      out.menus = [m];
      out.ui.activeMenuId = m.id;
    }

    if (!out.hierarchy.folders.length) {
      out.hierarchy.folders = [
        { id: uid("f"), name: "root", menuIds: out.menus.map((m) => m.id) }
      ];
    }

    out.knots.forEach((k, i) => {
      k.title = normalizeLegacyNodeTitle(k.title, i);
    });

    syncHierarchyFromMenus(out);
    validateActiveMenu(out);
    return out;
  }

  function normalizeKnotIn(k) {
    const knot = createKnotModel({
      id: k.id,
      title: k.title,
      meta: k.meta
    });
    ensureKnotContent(knot);
    if (k.content && typeof k.content.text === "string") {
      knot.content.text = k.content.text;
    }
    return knot;
  }

  function validateActiveMenu(state) {
    const ids = new Set(state.menus.map((m) => m.id));
    if (!state.ui.activeMenuId || !ids.has(state.ui.activeMenuId)) {
      state.ui.activeMenuId = state.menus[0].id;
    }
  }

  function validateDocument(doc) {
    if (doc.spec !== SPEC) return "spec mismatch";
    if (!doc.document || !Array.isArray(doc.menus)) return "missing core fields";

    const knotIds = new Set(doc.knots.map((k) => k.id));
    const edgeIds = new Set(doc.edges.map((e) => e.id));
    const menuIds = new Set(doc.menus.map((m) => m.id));
    const packIds = new Set(doc.packs.map((p) => p.id));

    if (new Set(doc.knots.map((k) => k.id)).size !== doc.knots.length) return "duplicate knot id";
    if (new Set(doc.edges.map((e) => e.id)).size !== doc.edges.length) return "duplicate edge id";
    if (new Set(doc.packs.map((p) => p.id)).size !== doc.packs.length) return "duplicate pack id";
    if (new Set(doc.menus.map((m) => m.id)).size !== doc.menus.length) return "duplicate menu id";

    for (const e of doc.edges) {
      if (!knotIds.has(e.from) || !knotIds.has(e.to)) return "edge endpoint missing";
    }

    for (const m of doc.menus) {
      for (const id of m.knotIds) {
        if (!knotIds.has(id)) return "menu knot ref";
      }
      for (const id of m.edgeIds) {
        if (!edgeIds.has(id)) return "menu edge ref";
      }
    }

    for (const p of doc.packs) {
      for (const id of p.menuIds) {
        if (!menuIds.has(id)) return "pack menu ref";
      }
    }

    if (doc.ui.activeMenuId != null && !menuIds.has(doc.ui.activeMenuId)) {
      return "active menu invalid";
    }

    return null;
  }

  function migrateLegacyState(input) {
    const state = createDefaultState();
    const mainMenu = state.menus[0];
    const legacy = input && typeof input === "object" ? input : {};

    if (!Array.isArray(legacy.nodes)) {
      syncHierarchyFiles(state);
      return state;
    }

    const metaLegacy = { source: "legacy-flat", at: isoNow() };

    for (let i = 0; i < legacy.nodes.length; i++) {
      const n = legacy.nodes[i];
      const id = String(n.id || `k${Date.now()}_${i}`);
      const knot = createKnotModel({
        id,
        title: normalizeLegacyNodeTitle(n.title, i),
        meta: {}
      });
      knot.content.text = String(n.notes ?? n.text ?? "");

      if (n.type != null || n.notesExpanded != null || n.parentId != null) {
        knot.meta.legacy = {
          type: n.type,
          notesExpanded: n.notesExpanded,
          parentId: n.parentId,
          zIndex: n.zIndex
        };
      }
      if (n.parentId) knot.meta.parentId = String(n.parentId);

      const uiMeta = ensureKnotUiMeta(knot);
      uiMeta.contentExpanded = n.notesExpanded !== undefined ? Boolean(n.notesExpanded) : true;
      uiMeta.childrenCollapsed = Boolean(n.childrenCollapsed);

      state.knots.push(knot);
      mainMenu.knotIds.push(id);

      state.ui.layout.knots[id] = {
        x: Number.isFinite(n.x) ? n.x : 120 + i * 12,
        y: Number.isFinite(n.y) ? n.y : 80 + i * 10,
        width: Number.isFinite(n.noteWidth) ? n.noteWidth : 132,
        height: Number.isFinite(n.noteHeight) ? n.noteHeight : 42,
        zone: n.zone === "stash" ? "stash" : "canvas",
        zIndex: Number.isFinite(n.zIndex) ? n.zIndex : i + 1
      };
    }

    const kIds = new Set(state.knots.map((k) => k.id));

    if (Array.isArray(legacy.edges)) {
      for (let i = 0; i < legacy.edges.length; i++) {
        const e = legacy.edges[i];
        const from = String(e.from || "");
        const to = String(e.to || "");
        if (!kIds.has(from) || !kIds.has(to) || from === to) continue;
        const edge = {
          id: String(e.id || `e${Date.now()}_${i}`),
          from,
          to,
          relation: e.relation != null ? String(e.relation) : "link",
          meta: e.meta && typeof e.meta === "object" ? structuredClone(e.meta) : {}
        };
        state.edges.push(edge);
        mainMenu.edgeIds.push(edge.id);
      }
    }

    state.document.meta = { ...state.document.meta, legacy: metaLegacy };
    state.ui.activeMenuId = mainMenu.id;
    syncHierarchyFromMenus(state);
    syncHierarchyFiles(state);
    return state;
  }

  function getActiveMenu(state) {
    return getMenuById(state, state.ui.activeMenuId);
  }

  function getMenuById(state, menuId) {
    return state.menus.find((m) => m.id === menuId) || null;
  }

  function getKnotById(state, knotId) {
    return state.knots.find((k) => k.id === knotId) || null;
  }

  function getEdgeById(state, edgeId) {
    return state.edges.find((e) => e.id === edgeId) || null;
  }

  function getKnotIdsForMenu(state, menuId) {
    const m = getMenuById(state, menuId);
    return m ? m.knotIds.slice() : [];
  }

  function getEdgesForMenu(state, menuId) {
    const m = getMenuById(state, menuId);
    if (!m) return [];
    return m.edgeIds.map((id) => getEdgeById(state, id)).filter(Boolean);
  }

  function getKnotsForActiveMenu(state) {
    return getKnotIdsForMenu(state, state.ui.activeMenuId)
      .map((id) => getKnotById(state, id))
      .filter(Boolean);
  }

  function getEdgesForActiveMenu(state) {
    return getEdgesForMenu(state, state.ui.activeMenuId);
  }

  function getKnotLayout(state, knotId) {
    state.ui.layout.knots[knotId] = state.ui.layout.knots[knotId] || {
      x: 120,
      y: 80,
      width: 132,
      height: 42,
      zone: "canvas",
      zIndex: 1
    };
    return state.ui.layout.knots[knotId];
  }

  function setKnotLayout(state, knotId, patch) {
    const cur = { ...getKnotLayout(state, knotId), ...patch };
    state.ui.layout.knots[knotId] = cur;
    return cur;
  }

  function attachKnotToMenu(state, menuId, knotId) {
    const m = getMenuById(state, menuId);
    if (!m) return;
    if (!m.knotIds.includes(knotId)) m.knotIds.push(knotId);
    syncHierarchyFromMenus(state);
  }

  function attachEdgeToMenu(state, menuId, edgeId) {
    const m = getMenuById(state, menuId);
    if (!m) return;
    if (!m.edgeIds.includes(edgeId)) m.edgeIds.push(edgeId);
  }

  function ensureEdge(state, fromId, toId, relation) {
    const existing = state.edges.find((e) => e.from === fromId && e.to === toId);
    if (existing) {
      if (relation) existing.relation = relation;
      return existing;
    }
    const edge = createEdgeModel(fromId, toId, relation);
    state.edges.push(edge);
    const menu = getActiveMenu(state);
    if (menu) attachEdgeToMenu(state, menu.id, edge.id);
    return edge;
  }

  function syncHierarchyFromMenus(state) {
    const folder = state.hierarchy.folders[0];
    if (!folder) return;
    const seen = new Set();
    for (const m of state.menus) {
      if (!folder.menuIds.includes(m.id)) folder.menuIds.push(m.id);
      seen.add(m.id);
    }
    folder.menuIds = folder.menuIds.filter((id) => seen.has(id));
  }

  function syncHierarchyFiles(state) {
    state.files = state.files || { menuText: "", structureText: "" };
    state.files.structureText = buildMapTextFromHierarchy(state);
    state.files.menuText = buildMenuTextFromHierarchy(state);
  }

  function buildMapTextFromHierarchy(state) {
    const lines = ["# map/structure.txt (generated from hierarchy)"];
    for (const folder of state.hierarchy.folders) {
      lines.push(`folder:${folder.name} id:${folder.id}`);
      for (const mid of folder.menuIds) {
        const menu = getMenuById(state, mid);
        if (!menu) continue;
        lines.push(`  menu:${menu.name} id:${menu.id}`);
        for (const kid of menu.knotIds) {
          const k = getKnotById(state, kid);
          lines.push(`    knot:${kid}${k ? ` title:${escapeTitle(k.title)}` : ""}`);
        }
      }
    }
    return lines.join("\n");
  }

  function buildMenuTextFromHierarchy(state) {
    const lines = ["# menu/menu.txt (generated from hierarchy)"];
    for (const folder of state.hierarchy.folders) {
      lines.push(`[${folder.name}]`);
      for (const mid of folder.menuIds) {
        const menu = getMenuById(state, mid);
        if (!menu) continue;
        lines.push(`  ${menu.name}`);
        for (const kid of menu.knotIds) {
          lines.push(`    ${kid}`);
        }
      }
    }
    return lines.join("\n");
  }

  function escapeTitle(t) {
    return String(t).replace(/\s+/g, " ").slice(0, 40);
  }

  function touchDocumentUpdated(state) {
    state.document.updatedAt = isoNow();
  }

  function parseStructureTextAndApply(state, text) {
    if (!text || typeof text !== "string") return;
    const lines = text.split(/\n/).filter((l) => !l.trim().startsWith("#"));
    let currentMenu = null;

    for (const raw of lines) {
      if (!raw.trim()) continue;
      const line = raw.trim();

      if (line.startsWith("folder:")) {
        currentMenu = null;
        continue;
      }
      const menuMatch = line.match(/^menu:(.+?)\s+id:(\S+)/);
      const knotMatch = line.match(/^knot:(\S+)/);
      if (menuMatch) {
        const menuName = menuMatch[1].trim();
        const menuId = menuMatch[2];
        let m = getMenuById(state, menuId);
        if (!m) {
          m = { id: menuId, name: menuName, knotIds: [], edgeIds: [], meta: {} };
          state.menus.push(m);
        } else {
          m.name = menuName;
        }
        currentMenu = m;
      } else if (knotMatch && currentMenu) {
        const kid = knotMatch[1];
        if (getKnotById(state, kid) && !currentMenu.knotIds.includes(kid)) {
          currentMenu.knotIds.push(kid);
        }
      }
    }
    syncHierarchyFromMenus(state);
  }

  function applyImportedFiles(state) {
    if (state.files && state.files.structureText) {
      parseStructureTextAndApply(state, state.files.structureText);
    }
  }
})();
