(function () {
  /*
   * Knots/edges/menus/roots live in one document; canvas shows the active menu slice.
   * ui.layout stores positions only — no semantic knot types in core paths.
   * Helpers use knot/menu names (setKnotLayout, getKnotIdsForMenu); legacy import keys may still say nodes/nodeIds.
   * files.menuText + files.structureText are regenerated from hierarchy + menus (single source).
   * Selection, drag, connect, hover are runtime-only and not exported.
   */
  const STORAGE_KEY = "ruvia.v2.state";
  const LEGACY_STORAGE_KEY = "ruvia.v1.state";
  const THEME_KEY = "ruvia.theme";
  const ZOOM_KEY = "ruvia.zoom";
  const GLOBAL_SCALE = 3;
  const SPEC = "ruvia-doc/0.1";
  const KNOT_SIZE = {
    width: 96,
    height: 28,
    minWidth: 72,
    minHeight: 18
  };
  const STASH_KNOT_SIZE = {
    width: 96,
    height: 28
  };
  const RUVIA_COLORS = [
    { name: "primrose", hex: "#efe5a8" },
    { name: "veridian", hex: "#008747" },
    { name: "sage", hex: "#90966f" },
    { name: "mallow", hex: "#d5648c" },
    { name: "rustrose", hex: "#b43c20" },
    { name: "tealbell", hex: "#009a9a" },
    { name: "coral", hex: "#ff8375" },
    { name: "violet", hex: "#5130ba" },
    { name: "aconite", hex: "#3f13a8" },
    { name: "clove", hex: "#4b383d" },
    { name: "thyme", hex: "#b6c9aa" },
    { name: "cotton", hex: "#fff8f4" },
    { name: "crimson", hex: "#d00045" },
    { name: "orchid", hex: "#d20a8c" },
    { name: "blush", hex: "#e8bdc8" },
    { name: "sulfur", hex: "#eedb00" },
    { name: "cinnabar", hex: "#e52b17" },
    { name: "cyanflower", hex: "#1aa8c0" },
    { name: "amethyst", hex: "#9462ba" },
    { name: "mintglass", hex: "#5ed0c8" },
    { name: "peach", hex: "#ffad8f" },
    { name: "magenta", hex: "#ef5ee8" },
    { name: "amber", hex: "#ed9900" },
    { name: "ruvia", hex: "#f4f4f4" },
    { name: "irisgray", hex: "#6c5a93" }
  ];

  const app = {
    state: loadState(),
    selectedKnotId: null,
    dragKnot: null,
    dragKnotLayer: null,
    offsetX: 0,
    offsetY: 0,
    connectFrom: null,
    tempPoint: null,
    hoverEdgeId: null,
    hoverKnotId: null,
    activeColorName: null,
    activeDefaultColorName: null,
    colorCursorEl: null,
    isColorDragging: false,
    zoom: loadZoom(),
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panOriginX: 0,
    panOriginY: 0,
    resizeObserver: null,
    dom: {}
  };

  init();

  function init() {
    app.dom.workspace = document.getElementById("workspace");
    app.dom.canvasPane = document.querySelector(".canvas-pane");
    app.dom.knotLayer = document.getElementById("knotLayer");
    app.dom.trayKnotLayer = document.getElementById("trayKnotLayer");
    app.dom.edgeLayer = document.getElementById("edgeLayer");
    app.dom.edgeToolLayer = ensureEdgeToolLayer();
    app.dom.tray = document.getElementById("tray");
    app.dom.templateTray = document.getElementById("templateTray");
    app.dom.newKnotBtn = document.getElementById("newKnotBtn");
    app.dom.exportBtn = document.getElementById("exportBtn");
    app.dom.importBtn = document.getElementById("importBtn");
    app.dom.importInput = document.getElementById("importInput");
    app.dom.resetBtn = document.getElementById("resetBtn");
    app.dom.trayImportBtn = document.getElementById("trayImportBtn");
    app.dom.trayExportBtn = document.getElementById("trayExportBtn");
    app.dom.trayCollapseBtn = document.getElementById("trayCollapseBtn");
    app.dom.trayDrawerToggle = document.getElementById("trayDrawerToggle");
    app.dom.menuDrawerToggle = document.getElementById("menuDrawerToggle");
    app.dom.colorDotBtn = document.getElementById("colorDotBtn");
    app.dom.colorPalette = document.getElementById("colorPalette");
    app.dom.zoomOutBtn = document.getElementById("zoomOutBtn");
    app.dom.zoomInBtn = document.getElementById("zoomInBtn");

    applySavedTheme();
    bindThemeHotkeys();
    bindToolbar();
    bindTrayActions();
    bindTrayCollapse();
    bindMobileTray();
    bindMobileMenu();
    bindZoomControls();
    bindKnotEvents();
    bindConnectEvents();
    bindEdgeEvents();
    bindCanvasPan();
    renderTemplates();
    renderColorPalette();
    bindColorPalette();
    normalizeAllLayoutSizes(app.state);

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
      link.download = `ruvia-root-${Date.now()}.root`;
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
        alert("Import root failed: invalid JSON");
      }
    });

    app.dom.resetBtn.addEventListener("click", () => {
      if (
        !confirm(
          "將刪除本機全部 Ruvia 資料（工作區、縮放、主題），並只載入示例樹。確定？"
        )
      ) {
        return;
      }
      clearRuviaLocalStorage();
      app.state = buildShowcaseInitialState();
      app.selectedKnotId = null;
      app.zoom = loadZoom();
      applySavedTheme();
      applyZoom();
      saveState();
      saveZoom();
      render();
    });
  }

  function bindTrayActions() {
    if (app.dom.trayImportBtn) {
      app.dom.trayImportBtn.addEventListener("click", () => {
        app.dom.importBtn.click();
      });
    }
    if (app.dom.trayExportBtn) {
      app.dom.trayExportBtn.addEventListener("click", () => {
        app.dom.exportBtn.click();
      });
    }
  }

  function bindMobileMenu() {
    if (!app.dom.menuDrawerToggle) return;
    app.dom.menuDrawerToggle.addEventListener("click", () => {
      document.body.classList.toggle("menu-drawer-open");
    });
  }

  function bindMobileTray() {
    if (!app.dom.trayDrawerToggle) return;
    app.dom.trayDrawerToggle.addEventListener("click", () => {
      document.body.classList.toggle("tray-drawer-open");
      if (document.body.classList.contains("tray-drawer-open")) {
        enforceMobileTrayLayout();
        render();
      }
    });
  }

  function getColorByName(name) {
    if (!name) return null;
    return RUVIA_COLORS.find((color) => color.name === name) || null;
  }

  function isMobileView() {
    return window.matchMedia("(max-width: 720px)").matches;
  }

  function updateColorDot(knot) {
    if (!app.dom.colorDotBtn) return;
    if (isMobileView() && app.activeDefaultColorName) {
      const active = getColorByName(app.activeDefaultColorName);
      app.dom.colorDotBtn.style.color = active ? active.hex : "var(--text-dim)";
      return;
    }
    const color = getColorByName(knot?.meta?.color);
    app.dom.colorDotBtn.style.color = color ? color.hex : "var(--text-dim)";
  }

  function renderColorPalette() {
    if (!app.dom.colorPalette) return;
    const frag = document.createDocumentFragment();
    for (const color of RUVIA_COLORS) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "palette-dot";
      dot.dataset.colorName = color.name;
      dot.title = color.name;
      dot.textContent = "●";
      dot.style.color = color.hex;
      dot.draggable = true;
      frag.append(dot);
    }
    app.dom.colorPalette.replaceChildren(frag);
  }

  function bindColorPalette() {
    if (!app.dom.colorPalette || !app.dom.colorDotBtn) return;

    app.dom.colorDotBtn.addEventListener("click", (event) => {
      if (!isMobileView()) return;
      event.preventDefault();
      event.stopPropagation();
      document.body.classList.toggle("color-palette-open");
    });

    document.addEventListener("click", (event) => {
      if (!isMobileView()) return;
      if (!document.body.classList.contains("color-palette-open")) return;
      if (event.target.closest(".color-controls")) return;
      document.body.classList.remove("color-palette-open");
    });

    app.dom.colorPalette.addEventListener("click", (event) => {
      const dot = event.target.closest(".palette-dot");
      if (!dot) return;
      const colorName = dot.dataset.colorName;
      if (!colorName) return;

      if (isMobileView()) {
        event.preventDefault();
        event.stopPropagation();
        app.activeDefaultColorName = colorName;
        updateColorDot(null);
        document.body.classList.remove("color-palette-open");
        return;
      }

      app.activeColorName = colorName;
      showColorCursor(colorName);
      document.body.classList.add("is-color-painting");
    });

    app.dom.colorPalette.addEventListener("dragstart", (event) => {
      const dot = event.target.closest(".palette-dot");
      if (!dot || !event.dataTransfer) return;
      event.dataTransfer.setData("text/plain", dot.dataset.colorName || "");
      event.dataTransfer.setData("text/ruvia-color", dot.dataset.colorName || "");
      event.dataTransfer.effectAllowed = "copy";
      app.isColorDragging = true;
      document.body.classList.add("is-color-dragging");
    });

    app.dom.colorPalette.addEventListener("dragend", () => {
      app.isColorDragging = false;
      document.body.classList.remove("is-color-dragging");
    });

    const handleColorDrop = (event) => {
      const colorName =
        event.dataTransfer?.getData("text/ruvia-color") ||
        event.dataTransfer?.getData("text/plain");
      if (!colorName) return;
      event.preventDefault();
      event.stopPropagation();
      const color = getColorByName(colorName);
      if (!color) return;

      const knotEl = event.target.closest(".knot");
      if (!knotEl) return;

      const knot = findKnot(knotEl.dataset.knotId);
      if (!knot) return;

      applyColorToKnot(knot, colorName);
    };

    const knotLayers = [app.dom.knotLayer, app.dom.trayKnotLayer].filter(Boolean);
    for (const layer of knotLayers) {
      layer.addEventListener("dragover", (event) => {
        const types = Array.from(event.dataTransfer?.types || []);
        if (types.includes("text/ruvia-color") || types.includes("text/plain")) {
          event.preventDefault();
        }
      });

      layer.addEventListener("drop", handleColorDrop);
    }

    app.dom.canvasPane.addEventListener("dragover", (event) => {
      const types = Array.from(event.dataTransfer?.types || []);
      if (types.includes("text/ruvia-color") || types.includes("text/plain")) {
        event.preventDefault();
      }
    });
    app.dom.canvasPane.addEventListener("drop", handleColorDrop);

    window.addEventListener("mousemove", (event) => {
      if (!app.activeColorName || !app.colorCursorEl) return;
      app.colorCursorEl.style.left = `${event.clientX + 8}px`;
      app.colorCursorEl.style.top = `${event.clientY + 8}px`;
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && app.activeColorName) {
        clearColorPaintMode();
      }
    });

    app.dom.canvasPane.addEventListener("click", (event) => {
      if (!app.activeColorName) return;
      if (event.target.closest(".knot")) return;
      clearColorPaintMode();
    });
  }

  function ensureColorCursor() {
    if (app.colorCursorEl) return app.colorCursorEl;
    const el = document.createElement("div");
    el.className = "color-cursor";
    document.body.appendChild(el);
    app.colorCursorEl = el;
    return el;
  }

  function showColorCursor(colorName) {
    const color = getColorByName(colorName);
    if (!color) return;
    const el = ensureColorCursor();
    el.style.background = color.hex;
    el.style.display = "block";
  }

  function clearColorPaintMode() {
    app.activeColorName = null;
    document.body.classList.remove("is-color-painting");
    if (app.colorCursorEl) app.colorCursorEl.style.display = "none";
  }

  function applyColorToKnot(knot, colorName) {
    const color = getColorByName(colorName);
    if (!color || !knot) return;
    knot.meta = knot.meta || {};
    knot.meta.color = colorName;
    updateColorDot(knot);
    touchDocumentUpdated();
    saveState();
    render();
  }

  function bindTrayCollapse() {
    if (!app.dom.trayCollapseBtn) return;

    app.dom.trayCollapseBtn.addEventListener("click", () => {
      document.body.classList.toggle("tray-collapsed");
      app.dom.trayCollapseBtn.textContent =
        document.body.classList.contains("tray-collapsed") ? "❮" : "❯";
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
  }

  function applyZoom() {
    const z = getEffectiveZoom();
    const transform = `translate(${app.panX || 0}px, ${app.panY || 0}px) scale(${z})`;
    app.dom.knotLayer.style.transformOrigin = "0 0";
    app.dom.knotLayer.style.transform = transform;
    app.dom.edgeLayer.style.transformOrigin = "0 0";
    app.dom.edgeToolLayer.style.transformOrigin = "0 0";
    app.dom.edgeLayer.style.transform = "";
    app.dom.edgeToolLayer.style.transform = "";
    if (app.dom.trayKnotLayer) {
      app.dom.trayKnotLayer.style.transform = "";
    }
    renderEdges();
  }

  function bindCanvasPan() {
    app.dom.canvasPane.addEventListener("mousedown", (event) => {
      if (app.isColorDragging) return;
      if (event.button !== 0) return;
      if (event.target.closest(".color-controls")) return;
      if (event.target.closest(".knot")) return;
      if (event.target.closest(".port")) return;
      if (event.target.closest(".side-add")) return;
      if (event.target.closest(".zoom-controls")) return;
      if (event.target.closest(".edge-cut")) return;

      event.preventDefault();

      app.isPanning = true;
      app.panStartX = event.clientX;
      app.panStartY = event.clientY;
      app.panOriginX = app.panX;
      app.panOriginY = app.panY;

      document.body.classList.add("is-panning");

      const onMove = (moveEvent) => {
        if (!app.isPanning) return;
        app.panX = app.panOriginX + (moveEvent.clientX - app.panStartX);
        app.panY = app.panOriginY + (moveEvent.clientY - app.panStartY);
        applyZoom();
      };

      const onUp = () => {
        app.isPanning = false;
        document.body.classList.remove("is-panning");
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
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
      btn.title = "New knot in tray";
      btn.addEventListener("click", () => {
        createKnot({
          contentExpanded: true,
          x: 8,
          y: countTrayKnots() * 36,
          width: STASH_KNOT_SIZE.width,
          zone: "tray"
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

    const knotLayers = [app.dom.knotLayer, app.dom.trayKnotLayer].filter(Boolean);

    for (const layer of knotLayers) {
      layer.addEventListener("mousemove", (event) => {
        const knotEl = event.target.closest(".knot");
        const knot = knotEl ? findKnot(knotEl.dataset.knotId) : null;
        app.hoverKnotId = knot ? knot.id : null;
        updateColorDot(knot);
      });

      layer.addEventListener("mouseleave", () => {
        app.hoverKnotId = null;
        updateColorDot(null);
      });

      if (layer === app.dom.knotLayer) {
        layer.addEventListener("mousemove", (event) => {
          const knotEl = event.target.closest(".knot");
          const current = layer.querySelector(".knot.hover-left, .knot.hover-right");
          if (!knotEl) {
            if (current) current.classList.remove("hover-left", "hover-right");
            return;
          }

          if (current && current !== knotEl) {
            current.classList.remove("hover-left", "hover-right");
          }

          const rect = knotEl.getBoundingClientRect();
          const isLeft = event.clientX < rect.left + rect.width / 2;
          knotEl.classList.toggle("hover-left", isLeft);
          knotEl.classList.toggle("hover-right", !isLeft);
        });

        layer.addEventListener("mouseleave", () => {
          const current = layer.querySelector(".knot.hover-left, .knot.hover-right");
          if (current) current.classList.remove("hover-left", "hover-right");
        });
      }

      layer.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        if (event.target.closest(".port")) return;

        if (event.target.closest(".delete-btn")) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        const sideBtn = event.target.closest(".side-add");
        if (sideBtn && sideBtn.contains(event.target) && !app.connectFrom) {
          event.preventDefault();
          event.stopPropagation();
          const knotEl = sideBtn.closest(".knot");
          if (!knotEl) return;
          const knot = findKnot(knotEl.dataset.knotId);
          if (!knot) return;
          createExtendedKnot(knot, sideBtn.dataset.side);
          touchDocumentUpdated();
          saveState();
          render();
          return;
        }

        if (app.connectFrom) return;

        const header = event.target.closest(".knot-header");
        if (!header) return;

        const knotEl = header.closest(".knot");
        if (!knotEl) return;

        const knot = findKnot(knotEl.dataset.knotId);
        if (!knot) return;

        app.selectedKnotId = knot.id;
        app.dragKnot = knot;
        app.dragKnotLayer = layer;
        bringKnotToFront(knot.id);

        const kr = knotEl.getBoundingClientRect();
        const sourceZone = getKnotLayout(app.state, knot.id).zone || "canvas";
        const sourceScale = sourceZone === "tray" ? 1 : getEffectiveZoom();
        app.offsetX = (event.clientX - kr.left) / sourceScale;
        app.offsetY = (event.clientY - kr.top) / sourceScale;

        const onMove = (moveEvent) => {
          const layout = getKnotLayout(app.state, knot.id);
          const inTray = isPointerInTray(moveEvent.clientX, moveEvent.clientY);
          const nextZone = inTray ? "tray" : "canvas";

          const zoneRect = nextZone === "tray"
            ? app.dom.trayKnotLayer.getBoundingClientRect()
            : app.dom.canvasPane.getBoundingClientRect();
          const scale = nextZone === "tray" ? 1 : getEffectiveZoom();
          const maxX = Math.max(0, zoneRect.width / scale - (layout.width || KNOT_SIZE.width));
          const maxY = Math.max(0, zoneRect.height / scale - (layout.height || KNOT_SIZE.height));
          const panX = nextZone === "tray" ? 0 : (app.panX || 0);
          const panY = nextZone === "tray" ? 0 : (app.panY || 0);
          layout.x = clamp((moveEvent.clientX - zoneRect.left - panX) / scale - app.offsetX, 0, maxX);
          layout.y = clamp((moveEvent.clientY - zoneRect.top - panY) / scale - app.offsetY, 0, maxY);
          layout.zone = nextZone;

          setKnotLayout(app.state, knot.id, layout);
          render();
          app.dom.tray.classList.toggle("is-active", inTray);
        };

        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);

          app.dragKnot = null;
          app.dragKnotLayer = null;
          app.dom.tray.classList.remove("is-active");

          touchDocumentUpdated();
          saveState();
          render();
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });

      layer.addEventListener("click", (event) => {
        if (app.activeColorName) {
          const targetKnotEl = event.target.closest(".knot");
          if (targetKnotEl) {
            event.preventDefault();
            event.stopPropagation();
            const paintKnot = findKnot(targetKnotEl.dataset.knotId);
            if (paintKnot) {
              applyColorToKnot(paintKnot, app.activeColorName);
            }
            clearColorPaintMode();
            return;
          }
        }

        const knotEl = event.target.closest(".knot");

        if (!knotEl) {
          app.selectedKnotId = null;
          render();
          return;
        }

        const knot = findKnot(knotEl.dataset.knotId);
        if (!knot) return;

        app.selectedKnotId = knot.id;

        if (event.target.closest(".delete-btn")) {
          event.preventDefault();
          event.stopPropagation();
          deleteKnot(knot.id);
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

      layer.addEventListener("input", (event) => {
        const knotEl = event.target.closest(".knot");
        if (!knotEl) return;

        const knot = findKnot(knotEl.dataset.knotId);
        if (!knot) return;

        if (event.target.classList.contains("knot-content-input")) {
          ensureKnotContent(knot).text = event.target.value;
          event.target.style.height = "auto";
          event.target.style.height = `${event.target.scrollHeight}px`;
          touchDocumentUpdated();
          saveState();
        }
      });

      layer.addEventListener(
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

      layer.addEventListener(
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

      layer.addEventListener("dblclick", (event) => {
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
  }

  function bindConnectEvents() {
    const knotLayers = [app.dom.knotLayer, app.dom.trayKnotLayer].filter(Boolean);
    for (const layer of knotLayers) {
      layer.addEventListener("mousedown", (event) => {
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
      app.tempPoint = point;
      renderEdges();

      const onMove = (moveEvent) => {
        const rect = app.dom.canvasPane.getBoundingClientRect();
        app.tempPoint = {
          x: moveEvent.clientX - rect.left,
          y: moveEvent.clientY - rect.top
        };
        renderEdges();
      };

      const onUp = (upEvent) => {
        const targetAtPoint = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        const targetPort = targetAtPoint?.closest?.(".port");

        if (targetPort) {
          const toEl = targetPort.closest(".knot");
          tryCreateEdge({
            fromKnotId: app.connectFrom.knotId,
            fromSide: app.connectFrom.side,
            toKnotId: toEl?.dataset.knotId,
            toSide: targetPort.dataset.side
          });
        } else {
          createKnotFromPortDrop(upEvent);
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
  }

  function bindEdgeEvents() {
    function setHoveredEdge(edgeId) {
      if (app.hoverEdgeId === edgeId) return;
      app.hoverEdgeId = edgeId;
      renderEdgeTools();
    }

    app.dom.edgeLayer.addEventListener("mouseover", (event) => {
      const path = event.target.closest(".edge");
      if (!path || !path.dataset.edgeId || path.classList.contains("temp")) return;
      setHoveredEdge(path.dataset.edgeId);
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

      setHoveredEdge(null);
    });

    app.dom.edgeToolLayer.addEventListener("mouseover", (event) => {
      const btn = event.target.closest(".edge-cut");
      if (!btn || !btn.dataset.edgeId) return;
      setHoveredEdge(btn.dataset.edgeId);
    });

    app.dom.edgeToolLayer.addEventListener("mouseout", (event) => {
      const btn = event.target.closest(".edge-cut");
      if (!btn || !btn.dataset.edgeId) return;
      const related = event.relatedTarget;
      if (
        related &&
        related.closest &&
        ((related.closest(".edge-cut") && related.closest(".edge-cut").dataset.edgeId === btn.dataset.edgeId) ||
          (related.closest(".edge") && related.closest(".edge").dataset.edgeId === btn.dataset.edgeId))
      ) {
        return;
      }
      setHoveredEdge(null);
    });

    app.dom.edgeToolLayer.addEventListener("mousedown", (event) => {
      const btn = event.target.closest(".edge-cut");
      if (!btn || !btn.dataset.edgeId) return;
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const edgeId = btn.dataset.edgeId;
      app.state.edges = app.state.edges.filter((edge) => edge.id !== edgeId);
      for (const menu of app.state.menus) {
        menu.edgeIds = menu.edgeIds.filter((id) => id !== edgeId);
      }
      setHoveredEdge(null);
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
      width: Number.isFinite(options.width) ? options.width : KNOT_SIZE.width,
      height: Number.isFinite(options.height) ? options.height : null,
      zone: options.zone ?? "canvas",
      zIndex: nextZIndex()
    };

    if (options.parentId != null) {
      knot.meta.parentId = String(options.parentId);
    }
    if (options.colorName) {
      knot.meta.color = options.colorName;
    } else if (app.activeDefaultColorName) {
      knot.meta.color = app.activeDefaultColorName;
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
    const srcLayout = getKnotLayout(app.state, sourceKnot.id);
    const branchIndex = app.state.edges.filter((e) =>
      side === "right" ? e.from === sourceKnot.id : e.to === sourceKnot.id
    ).length;
    const staggerY = branchIndex * 32;

    const newKnot = createKnot({
      parentKnot: sourceKnot,
      contentExpanded: true,
      x: side === "right" ? srcLayout.x + gapX : Math.max(0, srcLayout.x - gapX),
      y: srcLayout.y + staggerY,
      width: KNOT_SIZE.width,
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
    const from = findKnot(fromKnotId);
    const to = findKnot(toKnotId);
    if (!from || !to) return;
    if (getKnotLayout(app.state, from.id).zone !== "canvas") return;
    if (getKnotLayout(app.state, to.id).zone !== "canvas") return;

    // 從 right 拉出：source -> target
    if (fromSide === "right") {
      ensureEdge(app.state, fromKnotId, toKnotId, "link");
      return;
    }

    // 從 left 拉出：target -> source
    if (fromSide === "left") {
      ensureEdge(app.state, toKnotId, fromKnotId, "link");
      return;
    }
  }

  function createKnotFromPortDrop(event) {
    if (!app.connectFrom) return;

    const sourceKnot = findKnot(app.connectFrom.knotId);
    if (!sourceKnot) return;

    const rect = app.dom.canvasPane.getBoundingClientRect();
    const z = getEffectiveZoom();

    const x = (event.clientX - rect.left - (app.panX || 0)) / z;
    const y = (event.clientY - rect.top - (app.panY || 0)) / z;

    const newKnot = createKnot({
      parentKnot: app.connectFrom.side === "right" ? sourceKnot : null,
      contentExpanded: true,
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: KNOT_SIZE.width,
      height: KNOT_SIZE.height,
      zone: "canvas"
    });

    if (app.connectFrom.side === "right") {
      ensureEdge(app.state, sourceKnot.id, newKnot.id, "link");
    } else {
      ensureEdge(app.state, newKnot.id, sourceKnot.id, "link");
    }

    bringKnotToFront(newKnot.id);
    app.selectedKnotId = newKnot.id;
  }

  function render() {
    renderKnots();
    renderEdges();
    renderMenuPanel();
    requestAnimationFrame(autoFitTextareas);
  }

  function enforceMobileTrayLayout() {
    if (!window.matchMedia("(max-width: 720px)").matches) return;
    if (!app.dom.trayKnotLayer) return;

    const trayRect = app.dom.trayKnotLayer.getBoundingClientRect();
    if (!trayRect.width || !trayRect.height) return;

    const trayKnotIds = app.state.knots
      .filter((knot) => getKnotLayout(app.state, knot.id).zone === "tray")
      .map((knot) => knot.id);

    if (!trayKnotIds.length) return;

    const minY = 0;
    const visualWidth = 192;
    const visualHeight = 40;
    const maxX = Math.max(0, trayRect.width - visualWidth);
    const maxY = Math.max(0, trayRect.height - visualHeight);

    const hasOverflow = trayKnotIds.some((knotId) => {
      const layout = getKnotLayout(app.state, knotId);
      return layout.x < 0 || layout.x > maxX || layout.y < minY || layout.y > maxY;
    });

    if (!hasOverflow) return;

    for (const knotId of trayKnotIds) {
      const layout = getKnotLayout(app.state, knotId);
      setKnotLayout(app.state, knotId, {
        ...layout,
        x: maxX > 0 ? Math.random() * maxX : 0,
        y: maxY > minY ? minY + Math.random() * (maxY - minY) : 0,
        zone: "tray"
      });
    }
  }

  function renderKnots() {
    const visibleIds = new Set(getVisibleKnotIds());
    const canvasFrag = document.createDocumentFragment();
    const trayFrag = document.createDocumentFragment();

    for (const knot of app.state.knots) {
      if (!visibleIds.has(knot.id)) continue;

      const layout = getKnotLayout(app.state, knot.id);
      const uiMeta = knot.meta && knot.meta.ui ? knot.meta.ui : {};
      const contentExpanded = uiMeta.contentExpanded !== false;

      const knotEl = document.createElement("article");
      knotEl.className = "knot";
      knotEl.dataset.knotId = knot.id;
      const color = getColorByName(knot.meta?.color);
      if (color) {
        knotEl.dataset.color = color.name;
        knotEl.style.setProperty("--knot-accent", color.hex);
        if (color.name === "ruvia") {
          knotEl.style.setProperty("--knot-bg-accent", "var(--knot-bg)");
        } else {
          knotEl.style.setProperty("--knot-bg-accent", `${color.hex}26`);
        }
      } else {
        delete knotEl.dataset.color;
        knotEl.style.removeProperty("--knot-accent");
        knotEl.style.removeProperty("--knot-bg-accent");
      }
      knotEl.style.left = `${layout.x}px`;
      knotEl.style.top = `${layout.y}px`;
      knotEl.style.width = `${layout.width || KNOT_SIZE.width}px`;
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
      const contentText = ensureKnotContent(knot).text;
      textInput.value = contentText;
      textInput.placeholder = "content";
      textInput.style.height = "auto";

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

      if (layout.zone === "tray") {
        if (contentText.trim() !== "") {
          contentWrap.append(textInput);
          knotEl.append(header, contentWrap);
        } else {
          knotEl.classList.add("is-empty-content");
          knotEl.append(header);
        }
        trayFrag.append(knotEl);
      } else {
        if (contentText.trim() !== "") {
          contentWrap.append(textInput);
          knotEl.append(header, contentWrap, leftPort, rightPort, addLeft, addRight);
        } else {
          knotEl.classList.add("is-empty-content");
          knotEl.append(header, leftPort, rightPort, addLeft, addRight);
        }
        canvasFrag.append(knotEl);
      }
    }

    app.dom.knotLayer.replaceChildren(canvasFrag);
    if (app.dom.trayKnotLayer) {
      app.dom.trayKnotLayer.replaceChildren(trayFrag);
    }
    bindKnotResizeObservers();
  }

  function bindKnotResizeObservers() {
    if (typeof ResizeObserver === "undefined") return;

    if (!app.resizeObserver) {
      app.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const textarea = entry.target;
          const knotEl = textarea.closest(".knot");
          if (!knotEl) continue;

          const knot = findKnot(knotEl.dataset.knotId);
          if (!knot) continue;
        }
        renderEdges();
      });
    }

    app.resizeObserver.disconnect();
    const textareas = [
      ...app.dom.knotLayer.querySelectorAll(".knot-content-input"),
      ...(app.dom.trayKnotLayer ? app.dom.trayKnotLayer.querySelectorAll(".knot-content-input") : [])
    ];
    for (const textarea of textareas) {
      app.resizeObserver.observe(textarea);
    }
  }

  function autoFitTextareas() {
    const inputs = document.querySelectorAll(".knot-content-input");
    for (const input of inputs) {
      input.style.height = "auto";
      input.style.height = `${input.scrollHeight}px`;
    }
  }

  function renderEdges() {
    const svg = app.dom.edgeLayer;
    const wr = app.dom.canvasPane.getBoundingClientRect();

    svg.setAttribute("width", String(wr.width));
    svg.setAttribute("height", String(wr.height));
    svg.setAttribute("viewBox", `0 0 ${wr.width} ${wr.height}`);

    const visibleIds = new Set(getVisibleKnotIds());
    const paths = [];

    const activeEdgeIds = new Set(getEdgesForActiveMenu(app.state).map((e) => e.id));

    for (const edge of app.state.edges) {
      if (!activeEdgeIds.has(edge.id)) continue;
      if (!visibleIds.has(edge.from) || !visibleIds.has(edge.to)) continue;
      if (getKnotLayout(app.state, edge.from).zone !== "canvas") continue;
      if (getKnotLayout(app.state, edge.to).zone !== "canvas") continue;

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
    const knotEl =
      app.dom.knotLayer.querySelector(`.knot[data-knot-id="${knotId}"]`) ||
      (app.dom.trayKnotLayer
        ? app.dom.trayKnotLayer.querySelector(`.knot[data-knot-id="${knotId}"]`)
        : null);
    if (!knotEl) return null;

    const port = knotEl.querySelector(`.port.${side}`);
    if (!port) return null;

    const wr = app.dom.canvasPane.getBoundingClientRect();
    const rect = port.getBoundingClientRect();

    return {
      x: rect.left - wr.left + rect.width / 2,
      y: rect.top - wr.top + rect.height / 2
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

  function saveState() {
    syncHierarchyFiles(app.state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(app.state));
  }

  /** 清除本機與 Ruvia 相關的 localStorage（工作區、舊版存檔、主題、縮放） */
  function clearRuviaLocalStorage() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(THEME_KEY);
    localStorage.removeItem(ZOOM_KEY);
  }

  function loadState() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return buildShowcaseInitialState();
      return loadFromImport(JSON.parse(raw));
    } catch (_error) {
      return buildShowcaseInitialState();
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

  function createFallbackMenuRow(opts = {}) {
    const row = document.createElement("div");
    row.className = `menu-item${opts.active ? " active" : ""}`;

    const prefix = document.createElement("span");
    prefix.className = "menu-item-prefix";
    prefix.textContent = "➢";

    const name = document.createElement("span");
    name.className = "menu-item-name";
    name.textContent = opts.label || "";

    row.append(prefix, name);
    if (typeof opts.onClick === "function") {
      row.addEventListener("click", opts.onClick);
    }
    return row;
  }

  function renderMenuPanel() {
    const list = document.getElementById("menu-panel-list");
    if (!list) return;

    const frag = document.createDocumentFragment();

    for (const menu of app.state.menus) {
      const rowOpts = {
        active: menu.id === app.state.ui.activeMenuId,
        label: menu.name || "Untitled tree",
        onClick: () => {
          app.state.ui.activeMenuId = menu.id;
          if (window.matchMedia("(max-width: 720px)").matches) {
            document.body.classList.remove("menu-drawer-open");
          }
          saveState();
          render();
        }
      };

      const row = createFallbackMenuRow(rowOpts);

      frag.append(row);
    }

    list.replaceChildren(frag);
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

  function isPointerInTray(clientX, clientY) {
    const trayRect = app.dom.tray.getBoundingClientRect();

    return (
      clientX >= trayRect.left &&
      clientX <= trayRect.right &&
      clientY >= trayRect.top &&
      clientY <= trayRect.bottom
    );
  }

  function getZoneRect(zone) {
    if (zone === "tray") {
      return app.dom.tray.getBoundingClientRect();
    }
    return app.dom.canvasPane.getBoundingClientRect();
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
      roots: [],
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

  /** 無 localStorage 或 Reset 時：首屏示例樹（knot-a 為樞紐，三叉 + 再長） */
  function buildShowcaseInitialState() {
    const state = createDefaultState();
    const menu = getActiveMenu(state);
    if (!menu) return state;

    const uiOpen = { contentExpanded: true };
    const specs = [
      {
        id: "demo_a",
        title: "knot-a",
        text: "messy thought\n\n三叉：\n\n再长：",
        layout: { x: 52, y: 88, width: 148, height: 92, zone: "canvas", zIndex: 1 }
      },
      {
        id: "demo_b",
        title: "knot-b",
        text: "system model",
        layout: { x: 268, y: 24, width: 136, height: 46, zone: "canvas", zIndex: 2 }
      },
      {
        id: "demo_c",
        title: "knot-c",
        text: "writing surface",
        layout: { x: 268, y: 104, width: 136, height: 46, zone: "canvas", zIndex: 3 }
      },
      {
        id: "demo_d",
        title: "knot-d",
        text: "execution path",
        layout: { x: 268, y: 184, width: 136, height: 46, zone: "canvas", zIndex: 4 }
      },
      {
        id: "demo_e",
        title: "knot-e",
        text: "rules / relations",
        layout: { x: 468, y: 52, width: 136, height: 46, zone: "canvas", zIndex: 5 }
      },
      {
        id: "demo_f",
        title: "knot-f",
        text: "prompt / text",
        layout: { x: 468, y: 112, width: 136, height: 46, zone: "canvas", zIndex: 6 }
      },
      {
        id: "demo_g",
        title: "knot-g",
        text: "next action",
        layout: { x: 468, y: 172, width: 136, height: 46, zone: "canvas", zIndex: 7 }
      }
    ];

    for (const s of specs) {
      state.knots.push({
        id: s.id,
        title: s.title,
        content: { text: s.text },
        meta: { ui: { ...uiOpen } }
      });
      attachKnotToMenu(state, menu.id, s.id);
      setKnotLayout(state, s.id, s.layout);
    }

    const hub = "demo_a";
    for (const leaf of ["demo_b", "demo_c", "demo_d", "demo_e", "demo_f", "demo_g"]) {
      ensureEdge(state, hub, leaf, "link");
    }

    touchDocumentUpdated(state);
    syncHierarchyFiles(state);
    return state;
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

  function createRoot(partial = {}) {
    return {
      id: partial.id ?? uid("r"),
      name: partial.name ?? "Root",
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
      roots: Array.isArray(input.roots)
        ? input.roots.map((r) => ({
            id: String(r.id || uid("r")),
            name: String(r.name || "Root"),
            menuIds: Array.isArray(r.menuIds)
              ? r.menuIds.map(String)
              : Array.isArray(r.listIds)
                ? r.listIds.map(String)
                : [],
            meta: r.meta && typeof r.meta === "object" ? structuredClone(r.meta) : {}
          }))
        : Array.isArray(input.packs)
          ? input.packs.map((p) => ({
            id: String(p.id || uid("r")),
            name: String(p.name || "Root"),
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
          width: Number.isFinite(n.noteWidth) ? n.noteWidth : KNOT_SIZE.width,
          height: Number.isFinite(n.noteHeight) ? n.noteHeight : KNOT_SIZE.height,
          zone: n.zone === "stash" || n.zone === "tray" ? "tray" : "canvas",
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

    normalizeAllLayoutSizes(out);
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
    const rootIds = new Set(doc.roots.map((r) => r.id));

    if (new Set(doc.knots.map((k) => k.id)).size !== doc.knots.length) return "duplicate knot id";
    if (new Set(doc.edges.map((e) => e.id)).size !== doc.edges.length) return "duplicate edge id";
    if (new Set(doc.roots.map((r) => r.id)).size !== doc.roots.length) return "duplicate root id";
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

    for (const r of doc.roots) {
      for (const id of r.menuIds) {
        if (!menuIds.has(id)) return "root menu ref";
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
        width: Number.isFinite(n.noteWidth) ? n.noteWidth : KNOT_SIZE.width,
        height: Number.isFinite(n.noteHeight) ? n.noteHeight : KNOT_SIZE.height,
        zone: n.zone === "stash" || n.zone === "tray" ? "tray" : "canvas",
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
    normalizeAllLayoutSizes(state);
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
      width: KNOT_SIZE.width,
      height: null,
      zone: "canvas",
      zIndex: 1
    };
    return state.ui.layout.knots[knotId];
  }

  function countTrayKnots() {
    return app.state.knots.filter((k) => {
      const layout = getKnotLayout(app.state, k.id);
      return layout.zone === "tray";
    }).length;
  }

  function normalizeAllLayoutSizes(state) {
    const layouts = state?.ui?.layout?.knots;
    if (!layouts || typeof layouts !== "object") return;
    for (const id of Object.keys(layouts)) {
      const layout = layouts[id];
      if (!layout || typeof layout !== "object") continue;
      layout.width = KNOT_SIZE.width;
      if (!Number.isFinite(layout.height)) layout.height = null;
    }
  }

  function setKnotLayout(state, knotId, patch) {
    const cur = { ...getKnotLayout(state, knotId), ...patch };
    cur.width = KNOT_SIZE.width;
    if (!Number.isFinite(cur.height)) cur.height = null;
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

  function touchDocumentUpdated(state = app.state) {
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
